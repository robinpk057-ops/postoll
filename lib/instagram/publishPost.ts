import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";

/*
 * ================================================================
 * TYPES
 * ================================================================
 */

export type PublishPostResult = {
  success: true;
  platform: "instagram";
  contentId: string;
  account: {
    id: string;
    account_id: string;
    account_name: string;
  };
  publication: {
    creation_id: string;
    media_id: string | null;
  };
};

export class PublishPostError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "PublishPostError";
    this.status = status;
    this.details = details;
  }
}

/*
 * ================================================================
 * WAIT FOR CONTAINER TO FINISH PROCESSING
 * ================================================================
 *
 * Instagram creates the media container asynchronously — right
 * after POST /{ig-user-id}/media returns a creation_id, the
 * actual image may still be downloading/processing on
 * Instagram's side. Calling media_publish before that finishes
 * returns errors like "Media ID is not available".
 *
 * Instagram's own docs recommend polling status_code until it
 * reports FINISHED before publishing.
 */

async function waitForContainerReady(
  creationId: string,
  accessToken: string,
  maxAttempts = 8,
  delayMs = 3000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResponse = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${creationId}?fields=status_code&access_token=${encodeURIComponent(
        accessToken
      )}`,
      { cache: "no-store" }
    );

    const statusData = await statusResponse.json();

    if (!statusResponse.ok) {
      throw new PublishPostError(
        statusData?.error?.message ||
          "Unable to check media container status.",
        400,
        statusData
      );
    }

    const statusCode = statusData?.status_code;

    if (statusCode === "FINISHED") {
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new PublishPostError(
        `Instagram media container failed to process (status: ${statusCode}).`,
        400,
        statusData
      );
    }

    // status_code is IN_PROGRESS (or similar) — wait and check again.
    await new Promise((resolve) =>
      setTimeout(resolve, delayMs)
    );
  }

  throw new PublishPostError(
    "Timed out waiting for Instagram to finish processing the media container.",
    408
  );
}

/*
 * ================================================================
 * PUBLISH INSTAGRAM POST
 * ================================================================
 *
 * This is the shared publishing logic used by:
 *
 *   - app/api/publish/instagram/route.ts (manual publish,
 *     authenticated via the user's browser session)
 *
 *   - app/api/cron/scheduler/route.ts (automatic publish,
 *     triggered by an external scheduler with no user session)
 *
 * Both callers already know the correct userId before calling
 * this — the route derives it from the authenticated session,
 * the scheduler derives it from the workflow's owner.
 *
 * IMPORTANT:
 *
 * This is intentionally for IMAGE POSTS.
 * Reels use a separate publishing flow that does not exist yet.
 */

export async function publishInstagramPost(
  userId: string,
  contentId: string
): Promise<PublishPostResult> {
  /*
   * ------------------------------------------------------------
   * ENVIRONMENT
   * ------------------------------------------------------------
   */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new PublishPostError(
      "NEXT_PUBLIC_SUPABASE_URL is missing.",
      500
    );
  }

  if (!serviceRoleKey) {
    throw new PublishPostError(
      "SUPABASE_SERVICE_ROLE_KEY is missing.",
      500
    );
  }

  /*
   * ------------------------------------------------------------
   * SERVER-ONLY SUPABASE ADMIN CLIENT
   * ------------------------------------------------------------
   *
   * The service role key never goes to the browser.
   */

  const supabaseAdmin = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  /*
   * ------------------------------------------------------------
   * LOAD CONTENT
   * ------------------------------------------------------------
   */

  const { data: content, error: contentError } = await supabaseAdmin
    .from("content")
    .select(
      `
        id,
        user_id,
        type,
        platform,
        image_url,
        caption,
        hashtags,
        status
      `
    )
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contentError) {
    throw new PublishPostError(
      contentError.message || "Unable to load content.",
      500,
      contentError
    );
  }

  if (!content) {
    throw new PublishPostError(
      "Content was not found or does not belong to this account.",
      404
    );
  }

  /*
   * ------------------------------------------------------------
   * CONTENT TYPE
   * ------------------------------------------------------------
   */

  if (content.type === "reel") {
    throw new PublishPostError(
      "Reel publishing is not handled by the Instagram post publisher yet.",
      400
    );
  }

  /*
   * ------------------------------------------------------------
   * IMAGE URL
   * ------------------------------------------------------------
   */

  if (
    !content.image_url ||
    !content.image_url.startsWith("http")
  ) {
    throw new PublishPostError(
      "This content does not have a public image URL.",
      400
    );
  }

  /*
   * ------------------------------------------------------------
   * CAPTION
   * ------------------------------------------------------------
   */

  const captionParts: string[] = [];

  if (
    typeof content.caption === "string" &&
    content.caption.trim()
  ) {
    captionParts.push(content.caption.trim());
  }

  if (
    Array.isArray(content.hashtags) &&
    content.hashtags.length > 0
  ) {
    const hashtags = content.hashtags
      .filter(
        (tag): tag is string =>
          typeof tag === "string" && tag.trim().length > 0
      )
      .map((tag) => {
        const cleaned = tag.trim();

        return cleaned.startsWith("#")
          ? cleaned
          : `#${cleaned}`;
      });

    if (hashtags.length > 0) {
      captionParts.push(hashtags.join(" "));
    }
  }

  const caption = captionParts.join("\n\n");

  /*
   * ------------------------------------------------------------
   * FIND CONNECTED INSTAGRAM ACCOUNT
   * ------------------------------------------------------------
   */

  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select(
      `
        id,
        platform,
        account_id,
        account_name,
        access_token,
        connected
      `
    )
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .eq("connected", true)
    .limit(1)
    .maybeSingle();

  if (accountError) {
    throw new PublishPostError(
      accountError.message ||
        "Unable to load the connected Instagram account.",
      500,
      accountError
    );
  }

  if (!account) {
    throw new PublishPostError(
      "No connected Instagram account was found.",
      404
    );
  }

  /*
   * ------------------------------------------------------------
   * ACCESS TOKEN
   * ------------------------------------------------------------
   */

  if (!account.access_token) {
    throw new PublishPostError(
      "The connected Instagram account does not have an access token.",
      400
    );
  }

  /*
   * ------------------------------------------------------------
   * CREATE INSTAGRAM MEDIA CONTAINER
   * ------------------------------------------------------------
   */

  console.log("Creating Instagram media container:", {
    contentId: content.id,
    account: account.account_name,
    imageUrl: content.image_url,
  });

  const containerBody = new URLSearchParams();

  containerBody.set("image_url", content.image_url);

  if (caption) {
    containerBody.set("caption", caption);
  }

  containerBody.set("access_token", account.access_token);

  const containerResponse = await fetch(
    `${INSTAGRAM_GRAPH_URL}/${account.account_id}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: containerBody.toString(),
      cache: "no-store",
    }
  );

  const containerData = await containerResponse.json();

  if (!containerResponse.ok) {
    console.error(
      "Instagram media container error:",
      containerData
    );

    throw new PublishPostError(
      containerData?.error?.message ||
        "Instagram could not create the media container.",
      400,
      containerData
    );
  }

  const creationId = containerData?.id;

  if (!creationId) {
    throw new PublishPostError(
      "Instagram did not return a media creation ID.",
      400
    );
  }

  /*
   * ------------------------------------------------------------
   * WAIT FOR THE CONTAINER TO FINISH PROCESSING
   * ------------------------------------------------------------
   *
   * Publishing too early causes "Media ID is not available".
   */

  await waitForContainerReady(
    creationId,
    account.access_token
  );

  /*
   * ------------------------------------------------------------
   * PUBLISH MEDIA
   * ------------------------------------------------------------
   */

  console.log("Publishing Instagram media:", creationId);

  const publishBody = new URLSearchParams();

  publishBody.set("creation_id", creationId);
  publishBody.set("access_token", account.access_token);

  const publishResponse = await fetch(
    `${INSTAGRAM_GRAPH_URL}/${account.account_id}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: publishBody.toString(),
      cache: "no-store",
    }
  );

  const publishData = await publishResponse.json();

  if (!publishResponse.ok) {
    console.error("Instagram publish error:", publishData);

    throw new PublishPostError(
      publishData?.error?.message ||
        "Instagram could not publish the media.",
      400,
      { ...publishData, creationId }
    );
  }

  const mediaId = publishData?.id || null;

  console.log("Instagram published successfully:", {
    contentId: content.id,
    mediaId,
    account: account.account_name,
  });

  /*
   * ------------------------------------------------------------
   * SUCCESS
   * ------------------------------------------------------------
   */

  return {
    success: true,
    platform: "instagram",
    contentId: content.id,
    account: {
      id: account.id,
      account_id: account.account_id,
      account_name: account.account_name,
    },
    publication: {
      creation_id: creationId,
      media_id: mediaId,
    },
  };
}
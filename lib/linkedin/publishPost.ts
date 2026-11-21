import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export class PublishLinkedInError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "PublishLinkedInError";
    this.status = status;
    this.details = details;
  }
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new PublishLinkedInError("Supabase admin env missing", 500);
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export async function publishLinkedInPost(
  userId: string,
  contentId: string,
  overrideWorkflowId?: string | null,
  overrideAccountId?: string | null
) {
  const supabase = admin();

  const { data: content, error: contentError } = await supabase
    .from("content")
    .select("id, user_id, workflow_id, type, caption, hashtags, image_url")
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contentError || !content) {
    throw new PublishLinkedInError("Content not found.", 404);
  }

  let account: {
    id: string;
    account_id: string;
    account_name: string;
    access_token: string | null;
  } | null = null;

  const selectFields = "id, account_id, account_name, access_token";

  if (overrideAccountId) {
    const { data } = await supabase
      .from("accounts")
      .select(selectFields)
      .eq("id", overrideAccountId)
      .maybeSingle();
    if (data?.access_token) account = data;
  }

  const targetWorkflowId = overrideWorkflowId || content.workflow_id;
  if (!account && targetWorkflowId) {
    const { data: linkData } = await supabase
      .from("workflow_accounts")
      .select("account_id")
      .eq("workflow_id", targetWorkflowId)
      .ilike("platform", "linkedin")
      .maybeSingle();

    if (linkData?.account_id) {
      const { data } = await supabase
        .from("accounts")
        .select(selectFields)
        .eq("id", linkData.account_id)
        .maybeSingle();
      if (data?.access_token) account = data;
    }
  }

  if (!account) {
    const { data } = await supabase
      .from("accounts")
      .select(selectFields)
      .eq("user_id", userId)
      .ilike("platform", "linkedin")
      .limit(1)
      .maybeSingle();
    if (data?.access_token) account = data;
  }

  if (!account?.access_token) {
    throw new PublishLinkedInError("No connected LinkedIn account.", 400);
  }

  const authorUrn = account.account_id.startsWith("urn:li:")
    ? account.account_id
    : `urn:li:person:${account.account_id}`;

  const hashtagText = Array.isArray(content.hashtags)
    ? content.hashtags
        .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ")
    : "";

  const commentary = [content.caption, hashtagText]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!commentary) {
    throw new PublishLinkedInError(
      "LinkedIn post requires caption/commentary text.",
      400
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${account.access_token}`,
    "Content-Type": "application/json",
    "LinkedIn-Version": "202501",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  let mediaUrn: string | null = null;

  if (content.image_url && content.image_url.startsWith("http")) {
    if (content.type === "video" || isVideoUrl(content.image_url)) {
      throw new PublishLinkedInError(
        "Direct video upload to LinkedIn is not yet enabled in this publisher; use an image or text post.",
        400
      );
    }

    const imgRes = await fetch(content.image_url, { cache: "no-store" });
    if (!imgRes.ok) {
      throw new PublishLinkedInError(
        `Could not download image from image_url (${imgRes.status}).`,
        400
      );
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const initRes = await fetch(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          initializeUploadRequest: {
            owner: authorUrn,
          },
        }),
        cache: "no-store",
      }
    );

    const initData = await initRes.json().catch(() => ({}));
    const uploadUrl = initData?.value?.uploadUrl as string | undefined;
    mediaUrn = (initData?.value?.image as string) || null;

    if (!initRes.ok || !uploadUrl || !mediaUrn) {
      throw new PublishLinkedInError(
        initData?.message || "Failed to initialize LinkedIn image upload.",
        400,
        initData
      );
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type":
          imgRes.headers.get("content-type") || "image/jpeg",
      },
      body: imgBuffer,
      cache: "no-store",
    });

    if (!uploadRes.ok) {
      throw new PublishLinkedInError(
        `LinkedIn binary image upload failed (${uploadRes.status}).`,
        400
      );
    }
  }

  const postBody: Record<string, unknown> = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaUrn) {
    postBody.content = {
      media: {
        id: mediaUrn,
      },
    };
  }

  const postRes = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers,
    body: JSON.stringify(postBody),
    cache: "no-store",
  });

  const postData = await postRes.json().catch(() => ({}));

  if (!postRes.ok) {
    throw new PublishLinkedInError(
      postData?.message || `LinkedIn publish failed (${postRes.status})`,
      400,
      postData
    );
  }

  const postUrn =
    postRes.headers.get("x-restli-id") ||
    (postData?.id as string | undefined) ||
    null;

  return {
    success: true as const,
    platform: "linkedin" as const,
    contentId: content.id,
    account: {
      id: account.id,
      account_id: account.account_id,
      account_name: account.account_name,
    },
    publication: {
      post_urn: postUrn,
    },
  };
}

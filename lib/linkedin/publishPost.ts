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
    .select("id, user_id, workflow_id, type, title, caption, hashtags, image_url")
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contentError || !content) {
    throw new PublishLinkedInError("Content not found.", 404, contentError);
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

  const baseText = (content.caption || content.title || "").trim();
  const commentary =
    [baseText, hashtagText].filter(Boolean).join("\n\n").trim() ||
    "Shared via Postoll";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${account.access_token}`,
    "Content-Type": "application/json",
    "LinkedIn-Version": "202601",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  let mediaUrn: string | null = null;

  if (content.image_url && content.image_url.startsWith("http")) {
    const mediaRes = await fetch(content.image_url, { cache: "no-store" });
    if (!mediaRes.ok) {
      throw new PublishLinkedInError(
        `Could not download media from image_url (${mediaRes.status}).`,
        400
      );
    }

    const contentType = mediaRes.headers.get("content-type") || "";
    const isVideo =
      content.type === "video" ||
      isVideoUrl(content.image_url) ||
      contentType.startsWith("video/");

    const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());

    if (isVideo) {
      const initRes = await fetch(
        "https://api.linkedin.com/rest/videos?action=initializeUpload",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: authorUrn,
              fileSizeBytes: mediaBuffer.byteLength,
              uploadCaptions: false,
              uploadThumbnail: false,
            },
          }),
          cache: "no-store",
        }
      );

      const initData = await initRes.json().catch(() => ({}));
      const value = initData?.value;
      const videoUrn = value?.video as string | undefined;
      const uploadInstructions = Array.isArray(value?.uploadInstructions)
        ? value.uploadInstructions
        : [];
      const uploadToken = (value?.uploadToken as string) || "";

      if (!initRes.ok || !videoUrn || uploadInstructions.length === 0) {
        throw new PublishLinkedInError(
          initData?.message ||
            `Failed to initialize LinkedIn video upload (${initRes.status}).`,
          400,
          initData
        );
      }

      const uploadedPartIds: string[] = [];

      for (const part of uploadInstructions) {
        const start = Number(part.firstByte ?? 0);
        const end = Number(part.lastByte ?? mediaBuffer.byteLength - 1) + 1;
        const chunk = mediaBuffer.subarray(start, end);

        const partRes = await fetch(part.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: chunk,
          cache: "no-store",
        });

        if (!partRes.ok) {
          throw new PublishLinkedInError(
            `LinkedIn video chunk upload failed (${partRes.status}).`,
            400
          );
        }

        const etag = partRes.headers.get("etag");
        if (etag) {
          uploadedPartIds.push(etag.replace(/^"|"$/g, ""));
        }
      }

      const finRes = await fetch(
        "https://api.linkedin.com/rest/videos?action=finalizeUpload",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            finalizeUploadRequest: {
              video: videoUrn,
              uploadToken,
              uploadedPartIds,
            },
          }),
          cache: "no-store",
        }
      );

      if (!finRes.ok) {
        const finData = await finRes.json().catch(() => ({}));
        throw new PublishLinkedInError(
          finData?.message ||
            `LinkedIn video finalize failed (${finRes.status}).`,
          400,
          finData
        );
      }

      // Brief pause so LinkedIn registers the finalized video asset before /rest/posts
      await new Promise((resolve) => setTimeout(resolve, 3000));
      mediaUrn = videoUrn;
    } else {
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
          initData?.message ||
            `Failed to initialize LinkedIn image upload (${initRes.status}).`,
          400,
          initData
        );
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": contentType || "image/jpeg",
        },
        body: mediaBuffer,
        cache: "no-store",
      });

      if (!uploadRes.ok) {
        throw new PublishLinkedInError(
          `LinkedIn binary image upload failed (${uploadRes.status}).`,
          400
        );
      }
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
        title: content.title || "Postoll Video",
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

  const postText = await postRes.text();
  let postData: Record<string, unknown> = {};
  try {
    postData = postText ? JSON.parse(postText) : {};
  } catch {
    postData = { raw: postText };
  }

  if (!postRes.ok) {
    throw new PublishLinkedInError(
      (postData?.message as string) ||
        `LinkedIn publish failed (${postRes.status})`,
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
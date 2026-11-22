import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class PublishTikTokError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishTikTokError";
  }
}

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const MAX_CHUNK_BYTES = 10 * 1024 * 1024; // 10 MB

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new PublishTikTokError(
      "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function refreshTikTokAccessToken(
  supabase: SupabaseClient,
  accountRow: {
    id: string;
    user_id: string;
    refresh_token?: string | null;
  }
): Promise<string> {
  const clientKey = (
    process.env.TIKTOK_CLIENT_KEY ||
    process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY ||
    ""
  ).trim();
  const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || "").trim();

  if (!accountRow.refresh_token) {
    await supabase
      .from("accounts")
      .update({ connected: false })
      .eq("id", accountRow.id);
    throw new PublishTikTokError(
      "TikTok access token expired and no refresh token is saved. Please reconnect TikTok on /accounts."
    );
  }

  if (!clientKey || !clientSecret) {
    throw new PublishTikTokError(
      "TikTok access token expired and TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET env vars are missing on server."
    );
  }

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: accountRow.refresh_token,
  });

  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.access_token) {
    await supabase
      .from("accounts")
      .update({ connected: false })
      .eq("id", accountRow.id);

    throw new PublishTikTokError(
      `TikTok token refresh failed (${res.status}) [${
        data?.error || data?.error?.code || "invalid_grant"
      }]: ${
        data?.error_description ||
        data?.error?.message ||
        "Please reconnect TikTok on /accounts."
      }`
    );
  }

  const newAccessToken = String(data.access_token);
  const newRefreshToken = data.refresh_token
    ? String(data.refresh_token)
    : accountRow.refresh_token;
  const expiresInSec = Number(data.expires_in) || 86400;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  await supabase
    .from("accounts")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
      connected: true,
    })
    .eq("id", accountRow.id);

  return newAccessToken;
}

function buildCaptionText(input: {
  title?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
}): string {
  const baseText = (input.caption || input.title || "").trim();
  const tags = Array.isArray(input.hashtags)
    ? input.hashtags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    : [];

  return [baseText, tags.join(" ")]
    .filter(Boolean)
    .join("\n\n")
    .trim()
    .slice(0, 2200);
}

async function queryCreatorInfo(accessToken: string): Promise<{
  options: string[];
  unauthorized: boolean;
}> {
  const res = await fetch(
    `${TIKTOK_API_BASE}/post/publish/creator_info/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({}),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || data?.error?.code === "access_token_invalid") {
    return { options: [], unauthorized: true };
  }

  if (!res.ok || (data?.error?.code && data.error.code !== "ok")) {
    return { options: ["SELF_ONLY"], unauthorized: false };
  }

  return {
    options: Array.isArray(data?.data?.privacy_level_options)
      ? data.data.privacy_level_options
      : [],
    unauthorized: false,
  };
}

function choosePrivacyLevel(options: string[]): string {
  // Sandbox / unaudited TikTok apps only permit SELF_ONLY posts.
  // Switch priority to PUBLIC_TO_EVERYONE only after Content Posting API approval.
  if (options.includes("SELF_ONLY")) return "SELF_ONLY";
  if (options.includes("MUTUAL_FOLLOW_FRIENDS")) return "MUTUAL_FOLLOW_FRIENDS";
  if (options.includes("FOLLOWER_OF_CREATOR")) return "FOLLOWER_OF_CREATOR";
  if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  return options[0] || "SELF_ONLY";
}

async function waitForPublishCompletion(
  accessToken: string,
  publishId: string
): Promise<void> {
  let lastStatus = "UNKNOWN";
  let lastPayload: unknown = null;

  for (let attempt = 1; attempt <= 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    const data = await res.json().catch(() => ({}));
    lastPayload = data;
    const status = data?.data?.status as string | undefined;
    if (status) lastStatus = status;

    if (status === "PUBLISH_COMPLETE") {
      return;
    }

    if (status === "FAILED") {
      throw new PublishTikTokError(
        `TikTok Direct Post failed (${publishId}) [${
          data?.data?.fail_reason || "FAILED"
        }]: ${data?.data?.fail_reason || JSON.stringify(data)}`
      );
    }
  }

  throw new PublishTikTokError(
    `TikTok Direct Post timed out (${publishId}) in status ${lastStatus}: ${JSON.stringify(
      lastPayload
    )}`
  );
}

export async function publishTikTokVideo(
  userId: string,
  contentId: string,
  _workflowId?: string | null,
  accountId?: string | null
): Promise<{ publishId: string; privacyLevel: string }> {
  const supabase = getSupabaseAdminClient();

  const { data: contentRow, error: contentError } = await supabase
    .from("content")
    .select("id, title, idea, caption, hashtags, image_url")
    .eq("id", contentId)
    .eq("user_id", userId)
    .single();

  if (contentError || !contentRow) {
    throw new PublishTikTokError(
      `Content item ${contentId} not found for user ${userId}.`
    );
  }

  const videoUrl = contentRow.image_url?.trim();
  if (!videoUrl) {
    throw new PublishTikTokError(
      `Content item ${contentId} has no media/video URL.`
    );
  }

  const { data: accountRows, error: accountError } = await supabase
    .from("accounts")
    .select("id, user_id, account_id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "tiktok");

  const accountRow = accountId
    ? accountRows?.find(
        (row) => row.id === accountId || row.account_id === accountId
      ) ?? accountRows?.[0]
    : accountRows?.[0];

  if (accountError || !accountRow?.access_token) {
    throw new PublishTikTokError(
      "Connected TikTok account or access token not found. Please reconnect TikTok on /accounts."
    );
  }

  let accessToken = accountRow.access_token as string;

  // Proactively refresh if expires_at is past or within 5 minutes
  if (accountRow.expires_at) {
    const expMs = new Date(accountRow.expires_at).getTime();
    if (Number.isFinite(expMs) && expMs - Date.now() < 5 * 60 * 1000) {
      accessToken = await refreshTikTokAccessToken(supabase, accountRow);
    }
  }

  const mediaRes = await fetch(videoUrl);
  if (!mediaRes.ok) {
    throw new PublishTikTokError(
      `Failed to download video (${mediaRes.status}): ${videoUrl}`
    );
  }

  const contentTypeHeader = (
    mediaRes.headers.get("content-type") || ""
  ).toLowerCase();

  if (
    contentTypeHeader.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(videoUrl)
  ) {
    throw new PublishTikTokError(
      `TikTok video publishing requires an MP4/MOV/WebM video file, but this content item only has an image (${
        contentTypeHeader || videoUrl
      }).`
    );
  }

  const videoMimeType = contentTypeHeader.startsWith("video/")
    ? contentTypeHeader.split(";")[0].trim()
    : "video/mp4";

  const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());
  const videoSize = videoBuffer.byteLength;
  if (videoSize === 0) {
    throw new PublishTikTokError("Downloaded video file is empty.");
  }

  let creatorCheck = await queryCreatorInfo(accessToken);
  if (creatorCheck.unauthorized) {
    accessToken = await refreshTikTokAccessToken(supabase, accountRow);
    creatorCheck = await queryCreatorInfo(accessToken);
  }
  const privacyLevel = choosePrivacyLevel(creatorCheck.options);

  const chunkSize = videoSize <= MAX_CHUNK_BYTES ? videoSize : MAX_CHUNK_BYTES;
  const totalChunkCount = Math.ceil(videoSize / chunkSize);

  const title = buildCaptionText({
    title: contentRow.title,
    caption: contentRow.caption || contentRow.idea,
    hashtags: contentRow.hashtags,
  });

  const initPayload = JSON.stringify({
    post_info: {
      title,
      privacy_level: privacyLevel,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  });

  let initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: initPayload,
  });

  let initJson = await initRes.json().catch(() => ({}));

  if (
    initRes.status === 401 ||
    initJson?.error?.code === "access_token_invalid"
  ) {
    accessToken = await refreshTikTokAccessToken(supabase, accountRow);
    initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: initPayload,
    });
    initJson = await initRes.json().catch(() => ({}));
  }

  if (!initRes.ok || (initJson?.error?.code && initJson.error.code !== "ok")) {
    throw new PublishTikTokError(
      `TikTok Direct Post init failed (${initRes.status}) [${
        initJson?.error?.code || "unknown"
      }]: ${initJson?.error?.message || JSON.stringify(initJson)}`
    );
  }

  const publishId: string | undefined = initJson?.data?.publish_id;
  const uploadUrl: string | undefined = initJson?.data?.upload_url;

  if (!publishId || !uploadUrl) {
    throw new PublishTikTokError(
      `TikTok Direct Post response missing publish_id or upload_url: ${JSON.stringify(
        initJson
      )}`
    );
  }

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const isLast = i === totalChunkCount - 1;
    const end = isLast ? videoSize - 1 : start + chunkSize - 1;
    const chunkBytes = new Uint8Array(
      videoBuffer.buffer,
      videoBuffer.byteOffset + start,
      end - start + 1
    );

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": videoMimeType,
        "Content-Length": String(chunkBytes.byteLength),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: chunkBytes,
    });

    if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 206) {
      const errText = await uploadRes.text().catch(() => "");
      throw new PublishTikTokError(
        `TikTok chunk ${i + 1}/${totalChunkCount} upload failed (${
          uploadRes.status
        }) [mime=${videoMimeType}, size=${videoSize}]: ${errText}`
      );
    }
  }

  await waitForPublishCompletion(accessToken, publishId);

  return { publishId, privacyLevel };
}
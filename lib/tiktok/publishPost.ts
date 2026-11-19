import { createClient } from "@supabase/supabase-js";

export class PublishTikTokError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishTikTokError";
  }
}

const MAX_CHUNK_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_CHUNK_BYTES = 5 * 1024 * 1024; // 5 MB

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new PublishTikTokError(
      "Missing Supabase URL or service role key in server environment."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function refreshTikTokAccessToken(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  accountId: string,
  refreshToken: string
): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret || !refreshToken) {
    throw new PublishTikTokError(
      "TikTok access token expired and refresh credentials are missing."
    );
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new PublishTikTokError(
      `TikTok token refresh failed: ${data?.error_description || data?.error || res.statusText}`
    );
  }

  await supabaseAdmin
    .from("accounts")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
    })
    .eq("id", accountId);

  return data.access_token;
}

function buildCaption(
  caption: string | null,
  title: string | null,
  hashtags: unknown
): string {
  const base = (caption || title || "").trim();
  const tags = Array.isArray(hashtags)
    ? hashtags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    : [];

  const combined = [base, tags.join(" ")].filter(Boolean).join("\n\n").trim();
  return combined.slice(0, 2200);
}

function resolveVideoUrl(contentRow: Record<string, unknown>): string | null {
  const candidates = [
    contentRow.video_url,
    contentRow.media_url,
    contentRow.image_url,
    contentRow.file_url,
  ];

  for (const val of candidates) {
    if (typeof val === "string" && val.trim().startsWith("http")) {
      return val.trim();
    }
  }

  return null;
}

export async function publishTikTokVideo(
  userId: string,
  contentId: string,
  _workflowId?: string | null,
  targetAccountId?: string | null
): Promise<{ publishId: string }> {
  const supabaseAdmin = getSupabaseAdmin();

  // 1. Load connected TikTok account
  let accountQuery = supabaseAdmin
    .from("accounts")
    .select("id, platform, account_id, account_name, access_token, refresh_token")
    .eq("user_id", userId)
    .eq("platform", "tiktok");

  if (targetAccountId) {
    accountQuery = accountQuery.eq("id", targetAccountId);
  }

  const { data: accounts, error: accountError } = await accountQuery.limit(1);

  if (accountError) {
    throw new PublishTikTokError(`Failed to load TikTok account: ${accountError.message}`);
  }

  const account = accounts?.[0];
  if (!account || !account.access_token) {
    throw new PublishTikTokError("No connected TikTok account with a valid access token was found.");
  }

  // 2. Load content item
  const { data: content, error: contentError } = await supabaseAdmin
    .from("content")
    .select("*")
    .eq("id", contentId)
    .single();

  if (contentError || !content) {
    throw new PublishTikTokError(
      `Failed to load content ${contentId}: ${contentError?.message || "Not found"}`
    );
  }

  const videoUrl = resolveVideoUrl(content as Record<string, unknown>);
  if (!videoUrl) {
    throw new PublishTikTokError(
      "TikTok video publishing requires a valid video URL on the content record."
    );
  }

  // 3. Download video binary on server
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new PublishTikTokError(
      `Failed to download video from media URL (${videoRes.status} ${videoRes.statusText}).`
    );
  }

  const contentTypeHeader = (videoRes.headers.get("content-type") || "").toLowerCase();
  if (contentTypeHeader.startsWith("image/")) {
    throw new PublishTikTokError(
      `Content media is an image (${contentTypeHeader}), not a video. TikTok video upload requires a video file.`
    );
  }

  const arrayBuffer = await videoRes.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);
  const videoSize = videoBuffer.length;

  if (videoSize === 0) {
    throw new PublishTikTokError("Downloaded video file is empty (0 bytes).");
  }

  // TikTok FILE_UPLOAD chunking rules:
  // - If < 5 MB: single chunk equal to videoSize
  // - Otherwise: chunks up to 10 MB, merging any trailing remainder < 5 MB into the last chunk
  let chunkSize = videoSize;
  let totalChunkCount = 1;

  if (videoSize >= MIN_CHUNK_BYTES) {
    chunkSize = Math.min(MAX_CHUNK_BYTES, videoSize);
    const fullChunks = Math.floor(videoSize / chunkSize);
    const remainder = videoSize % chunkSize;

    if (remainder === 0) {
      totalChunkCount = fullChunks;
    } else if (remainder >= MIN_CHUNK_BYTES) {
      totalChunkCount = fullChunks + 1;
    } else {
      totalChunkCount = Math.max(1, fullChunks);
    }
  }

  const caption = buildCaption(
    typeof content.caption === "string" ? content.caption : null,
    typeof content.title === "string" ? content.title : null,
    content.hashtags
  );

  // 4. Initialize Inbox Video Upload (works when Direct Post is off)
  let accessToken = account.access_token;

  async function initUpload(token: string) {
    return fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: caption ? { title: caption } : {},
        source_info: {
          source: "FILE_UPLOAD",
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      }),
    });
  }

  let initRes = await initUpload(accessToken);
  let initData = await initRes.json();

  if (
    initData?.error?.code === "access_token_invalid" &&
    account.refresh_token
  ) {
    accessToken = await refreshTikTokAccessToken(
      supabaseAdmin,
      account.id,
      account.refresh_token
    );
    initRes = await initUpload(accessToken);
    initData = await initRes.json();
  }

  if (!initRes.ok || initData?.error?.code !== "ok" || !initData?.data?.upload_url) {
    throw new PublishTikTokError(
      `TikTok upload init failed: ${initData?.error?.message || initData?.error?.code || initRes.statusText}`
    );
  }

  const uploadUrl: string = initData.data.upload_url;
  const publishId: string = initData.data.publish_id || "";
  const mimeType =
    contentTypeHeader && contentTypeHeader.startsWith("video/")
      ? contentTypeHeader.split(";")[0]
      : "video/mp4";

  // 5. Upload chunk(s) to TikTok upload_url
  let offset = 0;
  for (let i = 0; i < totalChunkCount; i++) {
    const isLastChunk = i === totalChunkCount - 1;
    const end = isLastChunk ? videoSize : offset + chunkSize;
    const chunkBuffer = videoBuffer.subarray(offset, end);
    const lastByteIndex = end - 1;

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(chunkBuffer.length),
        "Content-Range": `bytes ${offset}-${lastByteIndex}/${videoSize}`,
      },
      body: chunkBuffer,
    });

    if (!putRes.ok) {
      const putErrText = await putRes.text().catch(() => "");
      throw new PublishTikTokError(
        `TikTok chunk upload ${i + 1}/${totalChunkCount} failed (${putRes.status}): ${putErrText || putRes.statusText}`
      );
    }

    offset = end;
  }

  return { publishId };
}
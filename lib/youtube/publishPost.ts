import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type PublishYouTubeResult = {
  success: true;
  platform: "youtube";
  contentId: string;
  videoId: string | null;
  account: {
    id: string;
    account_id: string;
    account_name: string;
  };
};

export class PublishYouTubeError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "PublishYouTubeError";
    this.status = status;
    this.details = details;
  }
}

export async function publishYouTubeVideo(
  userId: string,
  contentId: string
): Promise<PublishYouTubeResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new PublishYouTubeError("Supabase environment variables missing.", 500);
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Load Content (YouTube requires video/reel media)
  const { data: content, error: contentError } = await supabaseAdmin
    .from("content")
    .select("id, user_id, workflow_id, image_url, caption, hashtags, type")
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contentError || !content) {
    throw new PublishYouTubeError("Content not found.", 404, contentError);
  }

  if (!content.image_url || !content.image_url.startsWith("http")) {
    throw new PublishYouTubeError("YouTube requires a valid public video media URL.", 400);
  }

  // 2. Lookup Channel via workflow_accounts or fallback
  let account: any = null;

  if (content.workflow_id) {
    const { data: linked } = await supabaseAdmin
      .from("workflow_accounts")
      .select("accounts(id, platform, account_id, account_name, access_token, connected)")
      .eq("workflow_id", content.workflow_id)
      .eq("platform", "youtube")
      .limit(1)
      .maybeSingle();

    if (linked?.accounts) {
      const acc = Array.isArray(linked.accounts) ? linked.accounts[0] : linked.accounts;
      if (acc && acc.connected && acc.access_token) account = acc;
    }
  }

  if (!account) {
    const { data: fallback } = await supabaseAdmin
      .from("accounts")
      .select("id, platform, account_id, account_name, access_token, connected")
      .eq("user_id", userId)
      .eq("platform", "youtube")
      .eq("connected", true)
      .limit(1)
      .maybeSingle();

    account = fallback;
  }

  if (!account || !account.access_token) {
    throw new PublishYouTubeError("No connected YouTube channel found for this workflow.", 400);
  }

  // 3. Prepare Metadata & Tags
  const hashtags = Array.isArray(content.hashtags)
    ? content.hashtags.map((t: string) => (String(t).startsWith("#") ? t.replace("#", "") : t))
    : [];

  const title = content.caption ? content.caption.slice(0, 100) : "Postoll Video";
  const description = [content.caption || "", hashtags.map((t: string) => `#${t}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  // 4. Download video buffer from storage URL to stream or upload to YouTube
  const videoFetchRes = await fetch(content.image_url);
  if (!videoFetchRes.ok) {
    throw new PublishYouTubeError("Failed to fetch video file from storage URL for YouTube upload.", 400);
  }
  const videoBuffer = await videoFetchRes.arrayBuffer();

  // 5. YouTube Data API v3 - Multipart Upload
  const metadata = {
    snippet: {
      title,
      description,
      tags: hashtags,
      categoryId: "22", // People & Blogs category
    },
    status: {
      privacyStatus: "public", // Change to 'private' or 'unlisted' if testing
      selfDeclaredMadeForKids: false,
    },
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    new Blob([videoBuffer], { type: "video/mp4" })
  );

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
      body: form,
      cache: "no-store",
    }
  );

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    console.error("YouTube upload error:", uploadData);
    throw new PublishYouTubeError(
      uploadData?.error?.message || "YouTube upload failed.",
      400,
      uploadData
    );
  }

  return {
    success: true,
    platform: "youtube",
    contentId: content.id,
    videoId: uploadData?.id || null,
    account: {
      id: account.id,
      account_id: account.account_id,
      account_name: account.account_name,
    },
  };
}
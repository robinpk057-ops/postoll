import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishFacebookResult = {
  success: true;
  platform: "facebook";
  contentId: string;
  postId: string | null;
  account: {
    id: string;
    account_id: string;
    account_name: string;
  };
};

export class PublishFacebookError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "PublishFacebookError";
    this.status = status;
    this.details = details;
  }
}

export async function publishFacebookPost(
  userId: string,
  contentId: string
): Promise<PublishFacebookResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new PublishFacebookError("Supabase env is missing.", 500);
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: content, error: contentError } = await supabaseAdmin
    .from("content")
    .select("id, user_id, image_url, caption, hashtags, type")
    .eq("id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contentError || !content) {
    throw new PublishFacebookError("Content not found.", 404, contentError);
  }

  if (!content.image_url || !content.image_url.startsWith("http")) {
    throw new PublishFacebookError(
      "Content needs a public media URL for Facebook posts.",
      400
    );
  }

  const isVideo =
    content.type === "reel" ||
    /\.(mp4|mov|webm)(\?|$)/i.test(content.image_url || "");

  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("id, account_id, account_name, access_token, connected")
    .eq("user_id", userId)
    .eq("platform", "facebook")
    .eq("connected", true)
    .limit(1)
    .maybeSingle();

  if (accountError || !account?.access_token || !account.account_id) {
    throw new PublishFacebookError(
      "No connected Facebook Page found.",
      400,
      accountError
    );
  }

  const hashtags = Array.isArray(content.hashtags)
    ? content.hashtags
        .map((t: string) => (String(t).startsWith("#") ? t : `#${t}`))
        .join(" ")
    : typeof content.hashtags === "string"
      ? content.hashtags
      : "";

  const message = [content.caption || "", hashtags]
    .filter(Boolean)
    .join("\n\n");

  // VIDEO / REEL
  if (isVideo) {
    const body = new URLSearchParams();
    body.set("file_url", content.image_url);
    body.set("description", message);
    body.set("published", "true");
    body.set("access_token", account.access_token);

    const res = await fetch(`${GRAPH}/${account.account_id}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Facebook video publish error:", data);
      throw new PublishFacebookError(
        data?.error?.error_user_msg ||
          data?.error?.message ||
          "Facebook could not publish the video.",
        400,
        data
      );
    }

    return {
      success: true,
      platform: "facebook",
      contentId: content.id,
      postId: data?.id || data?.post_id || null,
      account: {
        id: account.id,
        account_id: account.account_id,
        account_name: account.account_name,
      },
    };
  }

  // PHOTO / IMAGE
  const body = new URLSearchParams();
  body.set("url", content.image_url);
  body.set("caption", message);
  body.set("published", "true");
  body.set("access_token", account.access_token);

  const res = await fetch(`${GRAPH}/${account.account_id}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Facebook publish error:", data);
    throw new PublishFacebookError(
      data?.error?.error_user_msg ||
        data?.error?.message ||
        "Facebook could not publish the photo.",
      400,
      data
    );
  }

  return {
    success: true,
    platform: "facebook",
    contentId: content.id,
    postId: data?.id || data?.post_id || null,
    account: {
      id: account.id,
      account_id: account.account_id,
      account_name: account.account_name,
    },
  };
}
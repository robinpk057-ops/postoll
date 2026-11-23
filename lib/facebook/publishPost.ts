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
  contentId: string,
  preferredAccountId?: string | null
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
    .select("id, user_id, workflow_id, image_url, caption, hashtags, type")
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
    content.type === "video" ||
    /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(content.image_url || "");

  /*
   * ------------------------------------------------------------
   * FIND CONNECTED FACEBOOK ACCOUNT (EXPLICIT ACCOUNT -> WORKFLOW -> FALLBACK)
   * ------------------------------------------------------------
   */
  let account: {
    id: string;
    platform: string;
    account_id: string;
    account_name: string;
    access_token: string;
    connected: boolean;
  } | null = null;

  if (preferredAccountId) {
    const { data: byRowId } = await supabaseAdmin
      .from("accounts")
      .select("id, platform, account_id, account_name, access_token, connected")
      .eq("id", preferredAccountId)
      .eq("user_id", userId)
      .eq("platform", "facebook")
      .eq("connected", true)
      .maybeSingle();

    if (byRowId) {
      account = byRowId;
    } else {
      const { data: byFbAccountId } = await supabaseAdmin
        .from("accounts")
        .select("id, platform, account_id, account_name, access_token, connected")
        .eq("account_id", preferredAccountId)
        .eq("user_id", userId)
        .eq("platform", "facebook")
        .eq("connected", true)
        .maybeSingle();

      account = byFbAccountId;
    }
  }

  if (!account && content.workflow_id) {
    const { data: linked, error: linkedError } = await supabaseAdmin
      .from("workflow_accounts")
      .select(
        `
        account_id,
        accounts (
          id,
          platform,
          account_id,
          account_name,
          access_token,
          connected
        )
      `
      )
      .eq("workflow_id", content.workflow_id)
      .eq("platform", "facebook")
      .limit(1)
      .maybeSingle();

    if (linkedError) {
      console.warn(
        "workflow_accounts facebook lookup failed, falling back:",
        linkedError.message
      );
    } else if (linked?.accounts) {
      const acc = Array.isArray(linked.accounts)
        ? linked.accounts[0]
        : linked.accounts;

      if (acc && acc.connected && acc.access_token) {
        account = acc;
      }
    }
  }

  if (!account) {
    const { data: fallback, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("id, platform, account_id, account_name, access_token, connected")
      .eq("user_id", userId)
      .eq("platform", "facebook")
      .eq("connected", true)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      throw new PublishFacebookError(
        accountError.message || "Unable to load the connected Facebook account.",
        500,
        accountError
      );
    }

    account = fallback;
  }

  if (!account || !account.access_token || !account.account_id) {
    throw new PublishFacebookError(
      "No connected Facebook Page found. Reconnect Facebook on /accounts.",
      400
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

  async function handleGraphFailure(data: any, fallbackMessage: string): Promise<never> {
    const fbCode = data?.error?.code;
    const rawMsg =
      data?.error?.error_user_msg ||
      data?.error?.message ||
      fallbackMessage;

    if (
      fbCode === 190 ||
      /validating access token|session has been invalidated|access token/i.test(
        rawMsg
      )
    ) {
      await supabaseAdmin
        .from("accounts")
        .update({ connected: false })
        .eq("id", account!.id)
        .eq("user_id", userId);

      throw new PublishFacebookError(
        `${rawMsg} Please reconnect ${account!.account_name || "Facebook"} on /accounts.`,
        401,
        data
      );
    }

    throw new PublishFacebookError(rawMsg, 400, data);
  }

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
      await handleGraphFailure(data, "Facebook could not publish the video.");
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
    await handleGraphFailure(data, "Facebook could not publish the photo.");
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
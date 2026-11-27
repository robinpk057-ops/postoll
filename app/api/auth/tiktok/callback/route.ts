import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { linkAccountToWorkflow } from "@/lib/account-guard";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      const msg = errorDescription ? `${error}: ${errorDescription}` : error;
      return NextResponse.redirect(
        new URL(`/accounts?error=${encodeURIComponent(msg)}`, SITE)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/accounts?error=Missing_TikTok_authorization_code", SITE)
      );
    }

    let decodedState: { userId?: string; workflowId?: string } | null = null;
    if (state) {
      try {
        decodedState = JSON.parse(
          Buffer.from(state, "base64").toString("utf-8")
        );
      } catch {
        // Ignore if state is a plain CSRF nonce
      }
    }

    let targetUserId: string | null = null;
    try {
      const serverSupabase = await createServerClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user?.id) {
        targetUserId = user.id;
      }
    } catch (e) {
      console.warn("Could not read server Supabase session in TikTok callback:", e);
    }

    if (!targetUserId && typeof decodedState?.userId === "string") {
      targetUserId = decodedState.userId;
    }

    if (!targetUserId) {
      return NextResponse.redirect(new URL("/login", SITE));
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(
        new URL("/accounts?error=Missing_Supabase_server_config", SITE)
      );
    }

    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const clientKey =
      process.env.TIKTOK_CLIENT_KEY || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri =
      process.env.TIKTOK_REDIRECT_URI || `${SITE}/api/auth/tiktok/callback`;

    const tokenResponse = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey || "",
          client_secret: clientSecret || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("TikTok token exchange failed:", tokenData);
      const detail =
        tokenData?.error_description ||
        tokenData?.error?.message ||
        "TikTok_Token_Exchange_Failed";
      return NextResponse.redirect(
        new URL(`/accounts?error=${encodeURIComponent(detail)}`, SITE)
      );
    }

    const accessToken: string = tokenData.access_token;
    const openId: string | undefined = tokenData.open_id;

    if (!openId) {
      return NextResponse.redirect(
        new URL("/accounts?error=TikTok_Missing_Open_ID", SITE)
      );
    }

    let accountName = "TikTok Account";
    let username: string | null = null;
    try {
      const userInfoResponse = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name,username",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const userInfoData = await userInfoResponse.json().catch(() => ({}));
      if (userInfoResponse.ok && userInfoData.data?.user) {
        username = userInfoData.data.user.username || null;
        accountName =
          userInfoData.data.user.display_name ||
          username ||
          "TikTok Account";
      }
    } catch (e) {
      console.warn("Could not fetch TikTok username:", e);
    }

    let targetWorkflowId =
      typeof decodedState?.workflowId === "string"
        ? decodedState.workflowId
        : undefined;

    if (!targetWorkflowId) {
      const { data: firstWorkflow } = await supabaseAdmin
        .from("workflows")
        .select("id")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      targetWorkflowId = firstWorkflow?.id;
    }

    if (!targetWorkflowId) {
      return NextResponse.redirect(
        new URL("/accounts?error=no_workflow", SITE)
      );
    }

    const expiresInSec = Number(tokenData.expires_in) || 86400;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const result = await linkAccountToWorkflow({
      supabaseAdmin,
      userId: targetUserId,
      workflowId: targetWorkflowId,
      platform: "tiktok",
      platformAccountId: openId,
      accountName,
      accessToken,
      refreshToken: tokenData.refresh_token || null,
      expiresAt,
      profileUrl: username ? `https://www.tiktok.com/@${username.replace(/^@/, "")}` : null,
    });

    if (!result.ok) {
      return NextResponse.redirect(
        new URL(`/accounts?error=${encodeURIComponent(result.errorCode)}`, SITE)
      );
    }

    return NextResponse.redirect(
      new URL(
        `/accounts?connected=tiktok&workflowId=${encodeURIComponent(targetWorkflowId)}`,
        SITE
      )
    );
  } catch (err) {
    console.error("TikTok callback exception:", err);
    return NextResponse.redirect(
      new URL("/accounts?error=TikTok_Callback_Exception", SITE)
    );
  }
}

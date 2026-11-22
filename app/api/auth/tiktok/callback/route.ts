import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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

    // 1) Resolve authenticated user from Supabase cookies first (just like Facebook callback)
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

    // 2) Fallback: decode userId from state if cookies weren't sent across redirect
    if (!targetUserId && state) {
      try {
        const decodedState = JSON.parse(
          Buffer.from(state, "base64").toString("utf-8")
        );
        if (decodedState?.userId && typeof decodedState.userId === "string") {
          targetUserId = decodedState.userId;
        }
      } catch {
        // Ignore if state is a plain CSRF nonce rather than base64 JSON
      }
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
        accountName =
          userInfoData.data.user.display_name ||
          userInfoData.data.user.username ||
          "TikTok Account";
      }
    } catch (e) {
      console.warn("Could not fetch TikTok username:", e);
    }

    const expiresInSec = Number(tokenData.expires_in) || 86400;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const { error: dbError } = await supabaseAdmin.from("accounts").upsert(
      {
        user_id: targetUserId,
        platform: "tiktok",
        account_name: accountName,
        account_id: openId,
        access_token: accessToken,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        connected: true,
      },
      { onConflict: "user_id,platform,account_id" }
    );

    if (dbError) {
      console.error("Database save error for TikTok:", dbError);
      return NextResponse.redirect(
        new URL(`/accounts?error=${encodeURIComponent(dbError.message)}`, SITE)
      );
    }

    return NextResponse.redirect(new URL("/accounts?connected=tiktok", SITE));
  } catch (err) {
    console.error("TikTok callback exception:", err);
    return NextResponse.redirect(
      new URL("/accounts?error=TikTok_Callback_Exception", SITE)
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Primary User ID established for your assets
const USER_ID = "60df30e2-f588-4f25-ae81-04104223e9a8";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/accounts?error=Missing_TikTok_authorization_code", request.url));
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

    // 1. Exchange authorization code for access token with TikTok API
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey || "",
        client_secret: clientSecret || "",
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("TikTok token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/accounts?error=TikTok_Token_Exchange_Failed", request.url));
    }

    const accessToken = tokenData.access_token;
    const openId = tokenData.open_id;

    if (!openId) {
      console.error("TikTok token response missing open_id:", tokenData);
      return NextResponse.redirect(new URL("/accounts?error=TikTok_Missing_Open_ID", request.url));
    }

    // 2. Fetch the user's profile display name using the User Info API
    let accountName = "TikTok Account";
    try {
      const userInfoResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,username", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userInfoData = await userInfoResponse.json();
      if (userInfoResponse.ok && userInfoData.data?.user) {
        accountName = userInfoData.data.user.display_name || userInfoData.data.user.username || "TikTok Account";
      }
    } catch (profileErr) {
      console.warn("Could not fetch TikTok user profile details, falling back to default name:", profileErr);
    }

    // 3. Upsert the connected account into your public.accounts table safely
    const { error: dbError } = await supabase.from("accounts").upsert({
      user_id: USER_ID,
      platform: "tiktok",
      account_name: accountName,
      account_id: openId,
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform,account_id" });

    if (dbError) {
      console.error("Database save error for TikTok:", dbError);
      return NextResponse.redirect(new URL("/accounts?error=Database_Save_Failed", request.url));
    }

    return NextResponse.redirect(new URL("/accounts?connected=tiktok", request.url));
  } catch (err) {
    console.error("TikTok callback exception:", err);
    return NextResponse.redirect(new URL("/accounts?error=TikTok_Callback_Error", request.url));
  }
}
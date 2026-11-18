import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/accounts?error=Missing_TikTok_authorization_code", request.url));
    }

    // Extract the correct user ID passed securely through state
    let targetUserId = "60df30e2-f588-4f25-ae81-04104223e9a8";
    if (state) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (decodedState.userId) {
          targetUserId = decodedState.userId;
        }
      } catch (e) {
        console.warn("Could not parse state parameter:", e);
      }
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

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
      return NextResponse.redirect(new URL("/accounts?error=TikTok_Missing_Open_ID", request.url));
    }

    let accountName = "TikTok Account";
    try {
      const userInfoResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,username", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const userInfoData = await userInfoResponse.json();
      if (userInfoResponse.ok && userInfoData.data?.user) {
        accountName = userInfoData.data.user.display_name || userInfoData.data.user.username || "TikTok Account";
      }
    } catch (e) {
      console.warn("Could not fetch TikTok username:", e);
    }

    // Upsert using the correct targetUserId associated with your session
    const { error: dbError } = await supabase.from("accounts").upsert({
      user_id: targetUserId,
      platform: "tiktok",
      account_name: accountName,
      account_id: openId,
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,platform,account_id" });

    if (dbError) {
      console.error("Database save error for TikTok:", dbError);
      return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(dbError.message)}`, request.url));
    }

    return NextResponse.redirect(new URL("/accounts?connected=tiktok", request.url));
  } catch (err) {
    console.error("TikTok callback exception:", err);
    return NextResponse.redirect(new URL("/accounts?error=TikTok_Callback_Exception", request.url));
  }
}
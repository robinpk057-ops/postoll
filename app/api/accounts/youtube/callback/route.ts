import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", SITE));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/accounts?error=youtube_${error || "no_code"}`, SITE)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/youtube/callback";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/accounts?error=youtube_config", SITE));
  }

  // 1) Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("YouTube token error:", tokenData);
    return NextResponse.redirect(new URL("/accounts?error=youtube_token", SITE));
  }

  const accessToken = tokenData.access_token as string;

  // 2) Fetch the user's YouTube Channel details
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  const channelData = await channelRes.json();

  if (!channelRes.ok || !Array.isArray(channelData.items) || channelData.items.length === 0) {
    console.error("YouTube channel fetch error:", channelData);
    return NextResponse.redirect(new URL("/accounts?error=youtube_no_channel", SITE));
  }

  const channel = channelData.items[0];
  const channelId = String(channel.id);
  const channelName = String(channel.snippet?.title || "YouTube Channel");

  // 3) Upsert into your existing `accounts` table
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .eq("account_id", channelId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("accounts")
      .update({
        account_name: channelName,
        access_token: accessToken,
        connected: true,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("accounts").insert({
      user_id: user.id,
      platform: "youtube",
      account_id: channelId,
      account_name: channelName,
      access_token: accessToken,
      connected: true,
    });
  }

  return NextResponse.redirect(new URL("/accounts?connected=youtube", SITE));
}
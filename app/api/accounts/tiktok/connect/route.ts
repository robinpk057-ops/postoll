import { NextResponse } from "next/server";

export async function POST() {
  try {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok Client Key is not configured in environment variables." },
        { status: 500 }
      );
    }

    // TikTok Login Kit & Content Posting API OAuth authorization URL including all active sandbox scopes
    const scopes = "user.info.basic,user.info.profile,video.upload,video.manage";
    const csrfState = Math.random().toString(36).substring(7);

    const authorizationUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${csrfState}`;

    return NextResponse.json({ authorizationUrl }, { status: 200 });
  } catch (err) {
    console.error("TikTok connect error:", err);
    return NextResponse.json(
      { error: "Failed to initiate TikTok connection." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok Client Key is not configured in environment variables." },
        { status: 500 }
      );
    }

    const scopes = "user.info.basic,user.info.profile,video.upload,video.manage,video.publish";
    
    // Embed both CSRF and the active user's ID into the state parameter
    const stateObj = {
      csrf: Math.random().toString(36).substring(7),
      userId: user?.id || "60df30e2-f588-4f25-ae81-04104223e9a8",
    };
    const csrfState = Buffer.from(JSON.stringify(stateObj)).toString("base64");

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
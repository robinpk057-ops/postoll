import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", SITE));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/accounts?error=linkedin_${error || "no_code"}`, SITE)
    );
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/linkedin/callback";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/accounts?error=linkedin_config", SITE)
    );
  }

  const tokenRes = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    }
  );

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("LinkedIn token error:", tokenData);
    return NextResponse.redirect(
      new URL("/accounts?error=linkedin_token", SITE)
    );
  }

  const accessToken = String(tokenData.access_token);
  const refreshToken = tokenData.refresh_token
    ? String(tokenData.refresh_token)
    : undefined;

  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const profileData = await profileRes.json().catch(() => ({}));

  if (!profileRes.ok || !profileData.sub) {
    console.error("LinkedIn profile fetch error:", profileData);
    return NextResponse.redirect(
      new URL("/accounts?error=linkedin_profile", SITE)
    );
  }

  const memberId = String(profileData.sub);
  const memberName = String(
    profileData.name ||
      [profileData.given_name, profileData.family_name]
        .filter(Boolean)
        .join(" ") ||
      "LinkedIn Profile"
  );

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "linkedin")
    .eq("account_id", memberId)
    .maybeSingle();

  let dbError = null;

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {
      account_name: memberName,
      access_token: accessToken,
      connected: true,
    };
    if (refreshToken) {
      updatePayload.refresh_token = refreshToken;
    }

    const { error: updateErr } = await supabase
      .from("accounts")
      .update(updatePayload)
      .eq("id", existing.id);
    dbError = updateErr;
  } else {
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      platform: "linkedin",
      account_id: memberId,
      account_name: memberName,
      access_token: accessToken,
      connected: true,
    };
    if (refreshToken) {
      insertPayload.refresh_token = refreshToken;
    }

    const { error: insertErr } = await supabase
      .from("accounts")
      .insert(insertPayload);
    dbError = insertErr;
  }

  if (dbError) {
    console.error("Supabase accounts save error:", dbError);
    return NextResponse.redirect(
      new URL("/accounts?error=database_save_failed", SITE)
    );
  }

  return NextResponse.redirect(new URL("/accounts?connected=linkedin", SITE));
}

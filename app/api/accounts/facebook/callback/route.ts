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
      new URL(`/accounts?error=facebook_${error || "no_code"}`, SITE)
    );
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri =
    process.env.FACEBOOK_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/facebook/callback";

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL("/accounts?error=facebook_config", SITE)
    );
  }

  // 1) Exchange code → user access token
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString(), { cache: "no-store" });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("FB token error:", tokenData);
    return NextResponse.redirect(
      new URL("/accounts?error=facebook_token", SITE)
    );
  }

  const userToken = tokenData.access_token as string;

  // 2) List Pages + page tokens
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(userToken)}`,
    { cache: "no-store" }
  );
  const pagesData = await pagesRes.json();

  if (!pagesRes.ok || !Array.isArray(pagesData.data) || pagesData.data.length === 0) {
    console.error("FB pages error:", pagesData);
    return NextResponse.redirect(
      new URL("/accounts?error=facebook_no_pages", SITE)
    );
  }

  // v1: save first page (later: let user pick)
  const page = pagesData.data[0];
  const pageId = String(page.id);
  const pageName = String(page.name || "Facebook Page");
  const pageToken = String(page.access_token);

  // 3) Upsert into accounts
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "facebook")
    .eq("account_id", pageId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("accounts")
      .update({
        account_name: pageName,
        access_token: pageToken,
        connected: true,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("accounts").insert({
      user_id: user.id,
      platform: "facebook",
      account_id: pageId,
      account_name: pageName,
      access_token: pageToken,
      connected: true,
    });
  }

  return NextResponse.redirect(new URL("/accounts?connected=facebook", SITE));
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";
const GRAPH = "https://graph.facebook.com/v21.0";

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

  // 1) Exchange code -> short-lived user access token
  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
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

  let userToken = tokenData.access_token as string;

  // 2) Exchange short-lived user token -> 60-day long-lived user token
  //    (so /me/accounts returns a permanent/non-expiring Page access token)
  try {
    const longLivedUrl = new URL(`${GRAPH}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", userToken);

    const longRes = await fetch(longLivedUrl.toString(), { cache: "no-store" });
    const longData = await longRes.json();
    if (longRes.ok && longData.access_token) {
      userToken = String(longData.access_token);
    } else {
      console.warn("FB long-lived token exchange warning:", longData);
    }
  } catch (e) {
    console.warn("FB long-lived token exchange exception:", e);
  }

  // 3) List Pages + permanent Page tokens
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?access_token=${encodeURIComponent(userToken)}`,
    { cache: "no-store" }
  );
  const pagesData = await pagesRes.json();

  if (
    !pagesRes.ok ||
    !Array.isArray(pagesData.data) ||
    pagesData.data.length === 0
  ) {
    console.error("FB pages error:", pagesData);
    return NextResponse.redirect(
      new URL("/accounts?error=facebook_no_pages", SITE)
    );
  }

  const page = pagesData.data[0];
  const pageId = String(page.id);
  const pageName = String(page.name || "Facebook Page");
  const pageToken = String(page.access_token);

  // 4) Upsert into accounts and verify write succeeds
  const { data: existing, error: lookupError } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", "facebook")
    .eq("account_id", pageId)
    .maybeSingle();

  if (lookupError) {
    console.error("FB account lookup error:", lookupError);
    return NextResponse.redirect(
      new URL(
        `/accounts?error=${encodeURIComponent(lookupError.message)}`,
        SITE
      )
    );
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        account_name: pageName,
        access_token: pageToken,
        connected: true,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("FB account update error:", updateError);
      return NextResponse.redirect(
        new URL(
          `/accounts?error=${encodeURIComponent(updateError.message)}`,
          SITE
        )
      );
    }
  } else {
    const { error: insertError } = await supabase.from("accounts").insert({
      user_id: user.id,
      platform: "facebook",
      account_id: pageId,
      account_name: pageName,
      access_token: pageToken,
      connected: true,
    });

    if (insertError) {
      console.error("FB account insert error:", insertError);
      return NextResponse.redirect(
        new URL(
          `/accounts?error=${encodeURIComponent(insertError.message)}`,
          SITE
        )
      );
    }
  }

  return NextResponse.redirect(new URL("/accounts?connected=facebook", SITE));
}
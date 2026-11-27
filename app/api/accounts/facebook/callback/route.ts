import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { linkAccountToWorkflow } from "@/lib/account-guard";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";
const GRAPH = "https://graph.facebook.com/v21.0";

function parseState(rawState: string | null, fallbackUserId: string): {
  userId: string;
  workflowId?: string;
} {
  if (!rawState) return { userId: fallbackUserId };
  try {
    const decoded = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
    return {
      userId: typeof decoded?.userId === "string" ? decoded.userId : fallbackUserId,
      workflowId: typeof decoded?.workflowId === "string" ? decoded.workflowId : undefined,
    };
  } catch {
    return { userId: rawState || fallbackUserId };
  }
}

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
  const parsedState = parseState(req.nextUrl.searchParams.get("state"), user.id);

  if (parsedState.userId !== user.id) {
    return NextResponse.redirect(new URL("/accounts?error=state_mismatch", SITE));
  }

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
    }
  } catch (e) {
    console.warn("FB long-lived token exchange exception:", e);
  }

  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,picture&access_token=${encodeURIComponent(userToken)}`,
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
  const pageAvatar = page.picture?.data?.url ?? null;

  let targetWorkflowId = parsedState.workflowId;
  if (!targetWorkflowId) {
    const { data: firstWorkflow } = await supabase
      .from("workflows")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    targetWorkflowId = firstWorkflow?.id;
  }

  if (!targetWorkflowId) {
    return NextResponse.redirect(new URL("/accounts?error=no_workflow", SITE));
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.redirect(new URL("/accounts?error=server_config", SITE));
  }

  const supabaseAdmin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await linkAccountToWorkflow({
    supabaseAdmin,
    userId: user.id,
    workflowId: targetWorkflowId,
    platform: "facebook",
    platformAccountId: pageId,
    accountName: pageName,
    accessToken: pageToken,
    profileUrl: `https://www.facebook.com/${pageId}`,
    profileImageUrl: pageAvatar,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(result.errorCode)}`, SITE)
    );
  }

  return NextResponse.redirect(
    new URL(`/accounts?connected=facebook&workflowId=${encodeURIComponent(targetWorkflowId)}`, SITE)
  );
}

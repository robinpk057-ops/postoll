import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { linkAccountToWorkflow } from "@/lib/account-guard";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";

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
  const { data: { user } } = await supabase.auth.getUser();

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
  const refreshToken = tokenData.refresh_token as string | undefined;
  const expiresAt = typeof tokenData.expires_in === "number"
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

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
  const thumbnailUrl = channel.snippet?.thumbnails?.default?.url ?? null;

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
    return NextResponse.redirect(new URL("/workflows/create?error=no_workflow", SITE));
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL");
    return NextResponse.redirect(new URL("/accounts?error=server_config", SITE));
  }

  const supabaseAdmin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await linkAccountToWorkflow({
    supabaseAdmin,
    userId: user.id,
    workflowId: targetWorkflowId,
    platform: "youtube",
    platformAccountId: channelId,
    accountName: channelName,
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt,
    profileUrl: `https://www.youtube.com/channel/${channelId}`,
    profileImageUrl: thumbnailUrl,
  });

  if (!result.ok) {
    console.error("YouTube linkAccountToWorkflow blocked:", result.errorCode);
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(result.errorCode)}`, SITE)
    );
  }

  return NextResponse.redirect(
    new URL(`/accounts?connected=youtube&workflowId=${encodeURIComponent(targetWorkflowId)}`, SITE)
  );
}

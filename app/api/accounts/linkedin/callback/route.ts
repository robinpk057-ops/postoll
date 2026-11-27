import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { linkAccountToWorkflow } from "@/lib/account-guard";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://postoll.vercel.app";

function parseState(
  rawState: string | null,
  fallbackUserId: string
): { userId: string; workflowId?: string } {
  if (!rawState) return { userId: fallbackUserId };
  try {
    const decoded = JSON.parse(
      Buffer.from(rawState, "base64url").toString("utf8")
    );
    return {
      userId:
        typeof decoded?.userId === "string" ? decoded.userId : fallbackUserId,
      workflowId:
        typeof decoded?.workflowId === "string" ? decoded.workflowId : undefined,
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
    return NextResponse.redirect(
      new URL("/accounts?error=state_mismatch", SITE)
    );
  }

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
  const expiresAt =
    typeof tokenData.expires_in === "number"
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

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
  const avatarUrl =
    typeof profileData.picture === "string" ? profileData.picture : null;

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
    return NextResponse.redirect(
      new URL("/accounts?error=no_workflow", SITE)
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.redirect(
      new URL("/accounts?error=server_config", SITE)
    );
  }

  const supabaseAdmin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await linkAccountToWorkflow({
    supabaseAdmin,
    userId: user.id,
    workflowId: targetWorkflowId,
    platform: "linkedin",
    platformAccountId: memberId,
    accountName: memberName,
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt,
    profileImageUrl: avatarUrl,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(result.errorCode)}`, SITE)
    );
  }

  return NextResponse.redirect(
    new URL(
      `/accounts?connected=linkedin&workflowId=${encodeURIComponent(targetWorkflowId)}`,
      SITE
    )
  );
}

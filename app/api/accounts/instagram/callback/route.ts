import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { linkAccountToWorkflow } from "@/lib/account-guard";

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("postoll_instagram_oauth_state");
  response.cookies.delete("postoll_instagram_oauth_user");
  response.cookies.delete("postoll_instagram_oauth_workflow");
}

function redirectToAccounts(
  request: NextRequest,
  status: "connected" | "error",
  message?: string,
  errorCode?: string
) {
  const url = new URL("/accounts", request.url);
  url.searchParams.set("instagram", status);
  if (errorCode) {
    url.searchParams.set("error", errorCode);
  }
  if (message) {
    url.searchParams.set("message", message);
  }
  const response = NextResponse.redirect(url);
  clearOAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const oauthErrorReason = searchParams.get("error_reason");
    const oauthErrorDescription = searchParams.get("error_description");

    if (oauthError) {
      console.error("Instagram OAuth error:", {
        error: oauthError,
        reason: oauthErrorReason,
        description: oauthErrorDescription,
      });
      return redirectToAccounts(
        request,
        "error",
        "Instagram authorization was cancelled or failed.",
        `instagram_${oauthError}`
      );
    }

    const storedState = request.cookies.get("postoll_instagram_oauth_state")?.value;
    const oauthUserId = request.cookies.get("postoll_instagram_oauth_user")?.value;
    const oauthWorkflowId = request.cookies.get("postoll_instagram_oauth_workflow")?.value;

    if (!state || !storedState || state !== storedState) {
      console.error("Instagram OAuth state validation failed.");
      return redirectToAccounts(
        request,
        "error",
        "Instagram connection could not be verified. Please try again.",
        "state_mismatch"
      );
    }

    if (!code) {
      return redirectToAccounts(
        request,
        "error",
        "Instagram did not return an authorization code.",
        "instagram_no_code"
      );
    }

    const instagramAppId = process.env.INSTAGRAM_APP_ID;
    const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET;
    const instagramRedirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!instagramAppId || !instagramAppSecret || !instagramRedirectUri) {
      return redirectToAccounts(
        request,
        "error",
        "Instagram OAuth environment variables are not configured.",
        "instagram_config"
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !oauthUserId || oauthUserId !== user.id) {
      return redirectToAccounts(
        request,
        "error",
        "Your Postoll login session could not be verified. Please log in again.",
        "session_mismatch"
      );
    }

    const tokenBody = new URLSearchParams({
      client_id: instagramAppId,
      client_secret: instagramAppSecret,
      grant_type: "authorization_code",
      redirect_uri: instagramRedirectUri,
      code,
    });

    const tokenResponse = await fetch(INSTAGRAM_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Instagram authorization-code exchange failed:", tokenData);
      return redirectToAccounts(
        request,
        "error",
        "Instagram authorization could not be completed.",
        "instagram_token"
      );
    }

    const shortLivedAccessToken = tokenData.access_token as string;
    const instagramUserId = tokenData.user_id ?? tokenData.instagram_user_id;

    const longLivedTokenUrl = new URL(`${INSTAGRAM_GRAPH_URL}/access_token`);
    longLivedTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longLivedTokenUrl.searchParams.set("client_secret", instagramAppSecret);
    longLivedTokenUrl.searchParams.set("access_token", shortLivedAccessToken);

    const longLivedResponse = await fetch(longLivedTokenUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || !longLivedData.access_token) {
      console.error("Instagram long-lived token exchange failed:", longLivedData);
      return redirectToAccounts(
        request,
        "error",
        "Instagram account authorization could not be completed.",
        "instagram_long_token"
      );
    }

    const accessToken = longLivedData.access_token as string;
    const expiresAt =
      typeof longLivedData.expires_in === "number"
        ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
        : null;

    const profileUrl = new URL(`${INSTAGRAM_GRAPH_URL}/me`);
    profileUrl.searchParams.set("fields", "id,username,account_type");
    profileUrl.searchParams.set("access_token", accessToken);

    const profileResponse = await fetch(profileUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });
    const profileData = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error("Instagram profile request failed:", profileData);
      return redirectToAccounts(
        request,
        "error",
        "Unable to retrieve your Instagram account.",
        "instagram_profile"
      );
    }

    const accountId = String(profileData.id || instagramUserId || "");
    const accountName = String(profileData.username || "Instagram");
    const accountType = profileData.account_type;

    if (!accountId) {
      return redirectToAccounts(
        request,
        "error",
        "Instagram account information was incomplete.",
        "instagram_missing_id"
      );
    }

    if (
      accountType &&
      !["BUSINESS", "CREATOR"].includes(String(accountType).toUpperCase())
    ) {
      return redirectToAccounts(
        request,
        "error",
        "Please connect an Instagram Business or Creator account.",
        "instagram_account_type"
      );
    }

    let targetWorkflowId = oauthWorkflowId;
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
      return redirectToAccounts(
        request,
        "error",
        "Create a workflow before connecting an Instagram account.",
        "no_workflow"
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return redirectToAccounts(
        request,
        "error",
        "Server configuration is incomplete.",
        "server_config"
      );
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await linkAccountToWorkflow({
      supabaseAdmin,
      userId: user.id,
      workflowId: targetWorkflowId,
      platform: "instagram",
      platformAccountId: accountId,
      accountName,
      accessToken,
      expiresAt,
      profileUrl: `https://www.instagram.com/${accountName.replace(/^@/, "")}/`,
    });

    if (!result.ok) {
      return redirectToAccounts(
        request,
        "error",
        "Unable to link Instagram account due to plan or duplicate account rules.",
        result.errorCode
      );
    }

    return redirectToAccounts(
      request,
      "connected",
      "Instagram connected successfully."
    );
  } catch (error) {
    console.error("Instagram callback error:", error);
    return redirectToAccounts(
      request,
      "error",
      "Something went wrong while connecting Instagram.",
      "instagram_callback_error"
    );
  }
}

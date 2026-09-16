import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete("postoll_instagram_oauth_state");
  response.cookies.delete("postoll_instagram_oauth_user");
}

function redirectToAccounts(
  request: NextRequest,
  status: "connected" | "error",
  message?: string
) {
  const url = new URL("/accounts", request.url);

  url.searchParams.set("instagram", status);

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
    const oauthErrorDescription =
      searchParams.get("error_description");

    /*
     * ---------------------------------------------------------
     * 1. Handle Instagram OAuth errors
     * ---------------------------------------------------------
     */

    if (oauthError) {
      console.error("Instagram OAuth error:", {
        error: oauthError,
        reason: oauthErrorReason,
        description: oauthErrorDescription,
      });

      return redirectToAccounts(
        request,
        "error",
        "Instagram authorization was cancelled or failed."
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Read and validate OAuth state
     * ---------------------------------------------------------
     */

    const storedState =
      request.cookies.get(
        "postoll_instagram_oauth_state"
      )?.value;

    const oauthUserId =
      request.cookies.get(
        "postoll_instagram_oauth_user"
      )?.value;

    if (!state || !storedState || state !== storedState) {
      console.error("Instagram OAuth state validation failed.");

      return redirectToAccounts(
        request,
        "error",
        "Instagram connection could not be verified. Please try again."
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Validate authorization code
     * ---------------------------------------------------------
     */

    if (!code) {
      return redirectToAccounts(
        request,
        "error",
        "Instagram did not return an authorization code."
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Validate environment variables
     * ---------------------------------------------------------
     */

    const instagramAppId =
      process.env.INSTAGRAM_APP_ID;

    const instagramAppSecret =
      process.env.INSTAGRAM_APP_SECRET;

    const instagramRedirectUri =
      process.env.INSTAGRAM_REDIRECT_URI;

    if (!instagramAppId) {
      console.error(
        "INSTAGRAM_APP_ID is not configured."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram App ID is not configured."
      );
    }

    if (!instagramAppSecret) {
      console.error(
        "INSTAGRAM_APP_SECRET is not configured."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram App Secret is not configured."
      );
    }

    if (!instagramRedirectUri) {
      console.error(
        "INSTAGRAM_REDIRECT_URI is not configured."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram redirect URL is not configured."
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Verify the Postoll user session
     * ---------------------------------------------------------
     */

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Unable to verify Postoll user:",
        userError
      );

      return redirectToAccounts(
        request,
        "error",
        "Your Postoll login session could not be verified. Please log in again."
      );
    }

    /*
     * The OAuth user cookie must match the authenticated
     * Supabase user.
     */

    if (!oauthUserId || oauthUserId !== user.id) {
      console.error(
        "Instagram OAuth user validation failed."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram connection could not be verified. Please try again."
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Exchange authorization code for short-lived token
     * ---------------------------------------------------------
     */

    const tokenBody = new URLSearchParams();

    tokenBody.set("client_id", instagramAppId);
    tokenBody.set(
      "client_secret",
      instagramAppSecret
    );
    tokenBody.set(
      "grant_type",
      "authorization_code"
    );
    tokenBody.set(
      "redirect_uri",
      instagramRedirectUri
    );
    tokenBody.set("code", code);

    const tokenResponse = await fetch(
      INSTAGRAM_TOKEN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: tokenBody.toString(),
        cache: "no-store",
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "Instagram authorization-code exchange failed:",
        tokenData
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram authorization could not be completed."
      );
    }

    const shortLivedAccessToken =
      tokenData.access_token;

    const instagramUserId =
      tokenData.user_id ??
      tokenData.instagram_user_id;

    if (!shortLivedAccessToken) {
      console.error(
        "Instagram did not return an access token."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram did not return a valid access token."
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. Exchange short-lived token for long-lived token
     * ---------------------------------------------------------
     */

    const longLivedTokenUrl =
      new URL(
        `${INSTAGRAM_GRAPH_URL}/access_token`
      );

    longLivedTokenUrl.searchParams.set(
      "grant_type",
      "ig_exchange_token"
    );

    longLivedTokenUrl.searchParams.set(
      "client_secret",
      instagramAppSecret
    );

    longLivedTokenUrl.searchParams.set(
      "access_token",
      shortLivedAccessToken
    );

    const longLivedResponse = await fetch(
      longLivedTokenUrl.toString(),
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const longLivedData =
      await longLivedResponse.json();

    if (!longLivedResponse.ok) {
      console.error(
        "Instagram long-lived token exchange failed:",
        longLivedData
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram account authorization could not be completed."
      );
    }

    const accessToken =
      longLivedData.access_token;

    if (!accessToken) {
      console.error(
        "Instagram did not return a long-lived access token."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram did not return a valid long-lived token."
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Fetch Instagram profile
     * ---------------------------------------------------------
     */

    const profileUrl =
      new URL(
        `${INSTAGRAM_GRAPH_URL}/me`
      );

    profileUrl.searchParams.set(
      "fields",
      "id,username,account_type"
    );

    profileUrl.searchParams.set(
      "access_token",
      accessToken
    );

    const profileResponse = await fetch(
      profileUrl.toString(),
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const profileData =
      await profileResponse.json();

    if (!profileResponse.ok) {
      console.error(
        "Instagram profile request failed:",
        profileData
      );

      return redirectToAccounts(
        request,
        "error",
        "Unable to retrieve your Instagram account."
      );
    }

    const accountId =
      profileData.id || instagramUserId;

    const accountName =
      profileData.username || "Instagram";

    const accountType =
      profileData.account_type;

    if (!accountId) {
      console.error(
        "Instagram account ID was not returned."
      );

      return redirectToAccounts(
        request,
        "error",
        "Instagram account information was incomplete."
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. Make sure the account can be used for publishing
     * ---------------------------------------------------------
     */

    if (
      accountType &&
      !["BUSINESS", "CREATOR"].includes(
        String(accountType).toUpperCase()
      )
    ) {
      console.error(
        "Instagram account type is not supported:",
        accountType
      );

      return redirectToAccounts(
        request,
        "error",
        "Please connect an Instagram Business or Creator account."
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. Check whether this Instagram account already exists
     * ---------------------------------------------------------
     */

    const {
      data: existingAccount,
      error: existingAccountError,
    } = await supabase
      .from("accounts")
      .select(
        "id, platform, account_name, account_id, connected"
      )
      .eq("user_id", user.id)
      .eq("platform", "instagram")
      .eq("account_id", accountId)
      .maybeSingle();

    if (existingAccountError) {
      console.error(
        "Unable to check existing Instagram account:",
        existingAccountError
      );

      return redirectToAccounts(
        request,
        "error",
        "Unable to save your Instagram connection."
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. Update existing account
     * ---------------------------------------------------------
     */

    if (existingAccount) {
      const { error: updateError } =
        await supabase
          .from("accounts")
          .update({
            account_name: accountName,
            access_token: accessToken,
            connected: true,
          })
          .eq("id", existingAccount.id)
          .eq("user_id", user.id);

      if (updateError) {
        console.error(
          "Unable to update Instagram account:",
          updateError
        );

        return redirectToAccounts(
          request,
          "error",
          "Unable to save your Instagram connection."
        );
      }
    } else {
      /*
       * -------------------------------------------------------
       * 12. Insert new account
       * -------------------------------------------------------
       */

      const { error: insertError } =
        await supabase
          .from("accounts")
          .insert({
            user_id: user.id,
            platform: "instagram",
            account_name: accountName,
            account_id: accountId,
            access_token: accessToken,
            connected: true,
          });

      if (insertError) {
        console.error(
          "Unable to insert Instagram account:",
          insertError
        );

        return redirectToAccounts(
          request,
          "error",
          "Unable to save your Instagram connection."
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 13. Success
     *
     * The access token is NEVER returned to the browser.
     * ---------------------------------------------------------
     */

    console.log(
      `Instagram account connected successfully: ${accountName} (${accountId})`
    );

    return redirectToAccounts(
      request,
      "connected",
      "Instagram connected successfully."
    );
  } catch (error) {
    console.error(
      "Instagram callback error:",
      error
    );

    return redirectToAccounts(
      request,
      "error",
      "Something went wrong while connecting Instagram."
    );
  }
}
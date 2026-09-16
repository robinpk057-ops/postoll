import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_AUTHORIZE_URL =
  "https://www.instagram.com/oauth/authorize";

export async function POST() {
  try {
    /*
    |--------------------------------------------------------------------------
    | ENVIRONMENT VARIABLES
    |--------------------------------------------------------------------------
    */

    const instagramAppId =
      process.env.INSTAGRAM_APP_ID;

    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI;

    if (!instagramAppId) {
      return NextResponse.json(
        {
          error:
            "INSTAGRAM_APP_ID is not configured in .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    if (!redirectUri) {
      return NextResponse.json(
        {
          error:
            "INSTAGRAM_REDIRECT_URI is not configured in .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | SUPABASE
    |--------------------------------------------------------------------------
    */

    const supabase =
      await createClient();

    /*
    |--------------------------------------------------------------------------
    | VERIFY POSTOLL USER
    |--------------------------------------------------------------------------
    */

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError) {
      console.error(
        "Supabase user error:",
        userError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your Postoll account.",
        },
        {
          status: 401,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Please log in to Postoll before connecting Instagram.",
        },
        {
          status: 401,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE OAUTH STATE
    |--------------------------------------------------------------------------
    |
    | We store the authenticated Postoll user ID in a secure,
    | HttpOnly, short-lived cookie.
    |
    | The state value itself is random and is also stored in
    | the cookie so the callback can verify the request.
    |
    */

    const stateBytes =
      crypto.getRandomValues(
        new Uint8Array(32)
      );

    const state = Array.from(
      stateBytes,
      (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");

    /*
    |--------------------------------------------------------------------------
    | BUILD INSTAGRAM AUTHORIZATION URL
    |--------------------------------------------------------------------------
    */

    const authorizationUrl =
      new URL(
        INSTAGRAM_AUTHORIZE_URL
      );

    authorizationUrl.searchParams.set(
      "client_id",
      instagramAppId
    );

    authorizationUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    authorizationUrl.searchParams.set(
      "response_type",
      "code"
    );

    authorizationUrl.searchParams.set(
      "scope",
      [
        "instagram_business_basic",
        "instagram_business_content_publish",
      ].join(",")
    );

    authorizationUrl.searchParams.set(
      "state",
      state
    );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    const response =
      NextResponse.json({
        success: true,
        authorizationUrl:
          authorizationUrl.toString(),
      });

    /*
    |--------------------------------------------------------------------------
    | STORE OAUTH STATE
    |--------------------------------------------------------------------------
    */

    response.cookies.set(
      "postoll_instagram_oauth_state",
      state,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      }
    );

    /*
    |--------------------------------------------------------------------------
    | STORE POSTOLL USER ID
    |--------------------------------------------------------------------------
    |
    | The callback can use this to verify that the OAuth
    | flow belongs to the authenticated Postoll user.
    |
    */

    response.cookies.set(
      "postoll_instagram_oauth_user",
      user.id,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Instagram OAuth start error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Instagram connection.",
      },
      {
        status: 500,
      }
    );
  }
}
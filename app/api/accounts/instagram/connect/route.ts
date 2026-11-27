import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

export async function POST(req: NextRequest) {
  try {
    const instagramAppId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!instagramAppId) {
      return NextResponse.json(
        { error: "INSTAGRAM_APP_ID is not configured in .env.local." },
        { status: 500 }
      );
    }

    if (!redirectUri) {
      return NextResponse.json(
        { error: "INSTAGRAM_REDIRECT_URI is not configured in .env.local." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Supabase user error:", userError);
      return NextResponse.json(
        { error: "Unable to verify your Postoll account." },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Please log in to Postoll before connecting Instagram." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let workflowId: string | undefined =
      typeof body?.workflowId === "string" && body.workflowId.trim()
        ? body.workflowId.trim()
        : undefined;

    if (!workflowId) {
      const { data: firstWorkflow } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      workflowId = firstWorkflow?.id;
    }

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(stateBytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");

    const authorizationUrl = new URL(INSTAGRAM_AUTHORIZE_URL);
    authorizationUrl.searchParams.set("client_id", instagramAppId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set(
      "scope",
      ["instagram_business_basic", "instagram_business_content_publish"].join(",")
    );
    authorizationUrl.searchParams.set("state", state);

    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      authorizationUrl: authorizationUrl.toString(),
    });

    response.cookies.set("postoll_instagram_oauth_state", state, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });

    response.cookies.set("postoll_instagram_oauth_user", user.id, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });

    if (workflowId) {
      response.cookies.set("postoll_instagram_oauth_workflow", workflowId, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Instagram OAuth start error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Instagram connection.",
      },
      { status: 500 }
    );
  }
}

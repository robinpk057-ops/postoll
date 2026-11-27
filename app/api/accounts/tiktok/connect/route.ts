import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://postoll.vercel.app"
).trim();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const clientKey = (
      process.env.TIKTOK_CLIENT_KEY ||
      process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY ||
      ""
    ).trim();

    const redirectUri = (
      process.env.TIKTOK_REDIRECT_URI || `${SITE}/api/auth/tiktok/callback`
    ).trim();

    if (!clientKey) {
      return NextResponse.json(
        {
          error:
            "TikTok Client Key is not configured in environment variables.",
        },
        { status: 500 }
      );
    }

    const scopes = "user.info.basic,video.publish";

    const stateObj = {
      csrf: Math.random().toString(36).substring(2, 12),
      userId: user.id,
      workflowId: workflowId ?? null,
    };
    const csrfState = Buffer.from(JSON.stringify(stateObj)).toString("base64");

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", csrfState);

    return NextResponse.json(
      { authorizationUrl: authUrl.toString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("TikTok connect error:", err);
    return NextResponse.json(
      { error: "Failed to initiate TikTok connection." },
      { status: 500 }
    );
  }
}

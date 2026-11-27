import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/youtube/callback";

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const scope = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, workflowId: workflowId ?? null })
  ).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("state", state);

  return NextResponse.json({
    authorizationUrl: url.toString(),
  });
}

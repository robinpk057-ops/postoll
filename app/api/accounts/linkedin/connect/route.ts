import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/linkedin/callback";

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const scope = ["openid", "profile", "w_member_social"].join(" ");
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, workflowId: workflowId ?? null })
  ).toString("base64url");

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return NextResponse.json({
    authorizationUrl: url.toString(),
  });
}

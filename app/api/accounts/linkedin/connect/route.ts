import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", user.id);

  return NextResponse.json({
    authorizationUrl: url.toString(),
  });
}

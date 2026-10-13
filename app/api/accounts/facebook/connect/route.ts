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

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri =
    process.env.FACEBOOK_REDIRECT_URI ||
    "https://postoll.vercel.app/api/accounts/facebook/callback";

  if (!appId) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID is not configured" },
      { status: 500 }
    );
  }

  const scope = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "public_profile",
  ].join(",");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", user.id);

  return NextResponse.json({
    authorizationUrl: url.toString(),
  });
}
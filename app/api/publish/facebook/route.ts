import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  publishFacebookPost,
  PublishFacebookError,
} from "@/lib/facebook/publishPost";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contentId } = await req.json();

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    const result = await publishFacebookPost(user.id, contentId);

    await supabase
      .from("content")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        platform: "facebook",
      })
      .eq("id", contentId)
      .eq("user_id", user.id);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Facebook publish route error:", err);
    const message =
      err instanceof PublishFacebookError || err instanceof Error
        ? err.message
        : "Publish failed";
    const status = err instanceof PublishFacebookError ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
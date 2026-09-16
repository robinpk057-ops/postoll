import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  publishInstagramPost,
  PublishPostError,
} from "@/lib/instagram/publishPost";

type PublishRequest = {
  contentId?: string;
};

export async function POST(request: Request) {
  try {
    /*
     * ============================================================
     * AUTHENTICATION
     * ============================================================
     */

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Please log in to Postoll first." },
        { status: 401 }
      );
    }

    /*
     * ============================================================
     * REQUEST
     * ============================================================
     */

    const body = (await request.json()) as PublishRequest;

    const contentId = body.contentId?.trim();

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId is required." },
        { status: 400 }
      );
    }

    /*
     * ============================================================
     * PUBLISH
     * ============================================================
     *
     * All of the actual Instagram publishing logic now lives in
     * lib/instagram/publishPost.ts, shared with the scheduler.
     */

    const result = await publishInstagramPost(user.id, contentId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Instagram publish API error:", error);

    if (error instanceof PublishPostError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish to Instagram.",
      },
      { status: 500 }
    );
  }
}
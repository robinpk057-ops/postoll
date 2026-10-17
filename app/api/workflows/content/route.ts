import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/*
 * ================================================================
 * REGISTER UPLOADED CONTENT
 * ================================================================
 *
 * The browser now uploads files DIRECTLY to Supabase Storage
 * (see the client-side change in review/page.tsx), instead of
 * sending the file bytes through this route.
 *
 * Vercel serverless functions have a small, non-configurable
 * request body limit — video files routinely exceed it, which
 * is exactly what caused the 413 "Payload Too Large" errors.
 *
 * This route only ever receives a small JSON payload: which
 * file path was just uploaded, and which workflow it belongs
 * to. It verifies ownership and creates the linked `content`
 * row — the actual bytes never pass through this function.
 */

type RegisterRequest = {
  workflowId?: string;
  filePath?: string;
  fileType?: "post" | "reel";
  uploadDescription?: string | null;
};

export async function POST(request: Request) {
  try {
    /*
     * ------------------------------------------------------------
     * AUTHENTICATION
     * ------------------------------------------------------------
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
     * ------------------------------------------------------------
     * ENVIRONMENT
     * ------------------------------------------------------------
     */

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server is missing required Supabase configuration." },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------------------
     * REQUEST BODY
     * ------------------------------------------------------------
     */

    const body = (await request.json()) as RegisterRequest;

    const workflowId = body.workflowId?.trim();
    const filePath = body.filePath?.trim();
    const fileType = body.fileType;

    if (!workflowId) {
      return NextResponse.json(
        { error: "workflowId is required." },
        { status: 400 }
      );
    }

    if (!filePath) {
      return NextResponse.json(
        { error: "filePath is required." },
        { status: 400 }
      );
    }

    if (fileType !== "post" && fileType !== "reel") {
      return NextResponse.json(
        { error: "fileType must be 'post' or 'reel'." },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * SECURITY CHECK
     * ------------------------------------------------------------
     *
     * The uploaded file's path must start with this user's own
     * ID — this is the same prefix the storage upload policy
     * enforces, checked again here so a forged filePath pointing
     * at someone else's files can't be registered as content.
     */

    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "That file path does not belong to this account." },
        { status: 403 }
      );
    }

    /*
     * ------------------------------------------------------------
     * SUPABASE ADMIN CLIENT
     * ------------------------------------------------------------
     */

    const supabaseAdmin = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * ------------------------------------------------------------
     * VERIFY WORKFLOW OWNERSHIP
     * ------------------------------------------------------------
     */

    const {
      data: workflowRow,
      error: workflowLookupError,
    } = await supabaseAdmin
      .from("workflows")
      .select("id, user_id")
      .eq("id", workflowId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (workflowLookupError) {
      return NextResponse.json(
        {
          error:
            workflowLookupError.message ||
            "Unable to verify workflow.",
        },
        { status: 500 }
      );
    }

    if (!workflowRow) {
      return NextResponse.json(
        {
          error:
            "Workflow was not found or does not belong to this account.",
        },
        { status: 404 }
      );
    }

    /*
     * ------------------------------------------------------------
     * VERIFY THE FILE ACTUALLY EXISTS IN STORAGE
     * ------------------------------------------------------------
     *
     * Guards against registering a content row for a path the
     * browser claims to have uploaded but didn't.
     */

    const lastSlash = filePath.lastIndexOf("/");
    const folder = filePath.slice(0, lastSlash);
    const fileName = filePath.slice(lastSlash + 1);

    const { data: listData, error: listError } =
      await supabaseAdmin.storage
        .from("postoll-media")
        .list(folder, { search: fileName });

    if (listError) {
      return NextResponse.json(
        {
          error:
            listError.message ||
            "Unable to verify the uploaded file.",
        },
        { status: 500 }
      );
    }

    const fileExists = (listData ?? []).some(
      (item) => item.name === fileName
    );

    if (!fileExists) {
      return NextResponse.json(
        {
          error:
            "The uploaded file could not be found in storage.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * GET PUBLIC URL + CREATE CONTENT ROW
     * ------------------------------------------------------------
     */

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("postoll-media")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { data: contentRow, error: contentError } =
      await supabaseAdmin
        .from("content")
        .insert({
          user_id: user.id,
          workflow_id: workflowId,
          type: fileType,
          platform: null,
          title: null,
          idea: null,
          concept: null,
          creative_intent: null,
          image_direction: null,
          plan: null,
          image_url: publicUrl,
          caption: body.uploadDescription || null,
          hashtags: [],
          status: "queued",
          published_at: null,
        })
        .select()
        .single();

    if (contentError) {
      return NextResponse.json(
        {
          error:
            contentError.message ||
            "Failed to save content record.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contentId: contentRow.id,
    });
  } catch (error) {
    console.error("Register content API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to register uploaded content.",
      },
      { status: 500 }
    );
  }
}

/*
 * ================================================================
 * ROLLBACK — DELETE REGISTERED CONTENT
 * ================================================================
 *
 * Used by activateWorkflow() if a later step in the same
 * activation fails after some content has already been
 * registered — lets the client clean up without needing its own
 * delete access to the content table.
 */

export async function DELETE(request: Request) {
  try {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server is missing required Supabase configuration." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      contentIds?: string[];
    };

    const contentIds = body.contentIds ?? [];

    if (contentIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const supabaseAdmin = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error } = await supabaseAdmin
      .from("content")
      .delete()
      .in("id", contentIds)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rollback content API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to roll back content.",
      },
      { status: 500 }
    );
  }
}
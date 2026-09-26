import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

type RegisterBody = {
  workflowId: string;
  filePath: string;
  fileType: "post" | "reel";
  uploadDescription?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as RegisterBody;
    const { workflowId, filePath, fileType, uploadDescription } = body;

    if (!workflowId || !filePath || !fileType) {
      return NextResponse.json(
        {
          success: false,
          error: "workflowId, filePath and fileType are required",
        },
        { status: 400 }
      );
    }

    if (fileType !== "post" && fileType !== "reel") {
      return NextResponse.json(
        { success: false, error: "fileType must be 'post' or 'reel'" },
        { status: 400 }
      );
    }

    // 1. Verify the workflow belongs to the authenticated user
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("id, user_id")
      .eq("id", workflowId)
      .eq("user_id", user.id)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json(
        { success: false, error: "Workflow not found" },
        { status: 404 }
      );
    }

    // 2. Path must start with the user's folder (security)
    const expectedPrefix = `${user.id}/${workflowId}/`;
    if (!filePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { success: false, error: "Invalid file path" },
        { status: 400 }
      );
    }

    // 3. Confirm the object exists in Storage
    const folder = `${user.id}/${workflowId}`;
    const fileName = filePath.split("/").pop() ?? "";

    const { data: listed, error: listError } = await supabase.storage
      .from("postoll-media")
      .list(folder, { search: fileName });

    if (listError || !listed?.some((f) => f.name === fileName)) {
      return NextResponse.json(
        { success: false, error: "File not found in storage" },
        { status: 404 }
      );
    }

    // 4. Public URL for Instagram (and other platforms)
    const {
      data: { publicUrl },
    } = supabase.storage.from("postoll-media").getPublicUrl(filePath);

    // 5. Insert content row
    const { data: content, error: insertError } = await supabase
      .from("content")
      .insert({
        user_id: user.id,
        workflow_id: workflowId,
        type: fileType,
        title: uploadDescription || null,
        caption: null,
        hashtags: [],
        image_url: publicUrl,
        status: "queued",
      })
      .select("id")
      .single();

    if (insertError || !content) {
      console.error("register-content insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to register content" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contentId: content.id,
      imageUrl: publicUrl,
    });
  } catch (err) {
    console.error("register-content POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { contentIds } = await req.json();

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "contentIds required" },
        { status: 400 }
      );
    }

    // Only delete rows that belong to this user
    const { error } = await supabase
      .from("content")
      .delete()
      .in("id", contentIds)
      .eq("user_id", user.id);

    if (error) {
      console.error("register-content DELETE error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to rollback content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("register-content DELETE error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
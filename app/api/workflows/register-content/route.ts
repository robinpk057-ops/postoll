import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCaptionFromIdea } from "@/lib/ai/generateCaption";

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

    const expectedPrefix = `${user.id}/${workflowId}/`;
    if (!filePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { success: false, error: "Invalid file path" },
        { status: 400 }
      );
    }

    const { data: fileMeta, error: downloadError } = await supabase.storage
      .from("postoll-media")
      .download(filePath);

    if (downloadError || !fileMeta) {
      console.error("Storage check failed:", downloadError);
      return NextResponse.json(
        { success: false, error: "File not found in storage" },
        { status: 404 }
      );
    }

    const fileBuffer = Buffer.from(await fileMeta.arrayBuffer());
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const { data: existingDup } = await supabase
      .from("content")
      .select("id")
      .eq("workflow_id", workflowId)
      .eq("file_hash", fileHash)
      .limit(1)
      .maybeSingle();

    if (existingDup?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate file already exists in this workflow.",
          duplicateContentId: existingDup.id,
        },
        { status: 409 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("postoll-media").getPublicUrl(filePath);

    const baseIdea = (uploadDescription || "").trim();
    let caption: string | null = baseIdea || null;
    let hashtags: string[] = [];

    if (baseIdea.length >= 3) {
      try {
        const ai = await generateCaptionFromIdea({
          description: baseIdea,
          contentType: fileType,
          variationSeed: `${workflowId}-${filePath}-${Date.now()}`,
        });

        if (ai?.caption) {
          caption = ai.caption;
          hashtags = ai.hashtags || [];
        }
      } catch (e) {
        console.error("AI caption failed, using user description:", e);
      }
    }

    const { data: content, error: insertError } = await supabase
      .from("content")
      .insert({
        user_id: user.id,
        workflow_id: workflowId,
        type: fileType,
        title: uploadDescription || null,
        caption: caption || uploadDescription || null,
        hashtags,
        image_url: publicUrl,
        file_hash: fileHash,
        status: "queued",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Register content insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error("Register content error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to register uploaded content.",
      },
      { status: 500 }
    );
  }
}

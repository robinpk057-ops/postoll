import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function getExtension(file: File): string {
  const mapped = MIME_EXTENSION_MAP[file.type];
  if (mapped) return mapped;

  const nameParts = file.name.split(".");
  if (nameParts.length > 1) {
    return nameParts[nameParts.length - 1].toLowerCase();
  }
  return "bin";
}

function getContentCategory(file: File): "post" | "reel" {
  if (file.type.startsWith("video/")) {
    return "reel";
  }
  return "post";
}

export async function POST(request: Request) {
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

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is missing." },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const workflowIdRaw = formData.get("workflowId");

    if (!workflowIdRaw || typeof workflowIdRaw !== "string") {
      return NextResponse.json(
        { error: "workflowId is required." },
        { status: 400 }
      );
    }

    const workflowId = workflowIdRaw;
    const uploadDescriptionRaw = formData.get("uploadDescription");
    const uploadDescription =
      typeof uploadDescriptionRaw === "string" && uploadDescriptionRaw.trim()
        ? uploadDescriptionRaw.trim()
        : null;

    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files were provided." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: workflowRow, error: workflowLookupError } = await supabaseAdmin
      .from("workflows")
      .select("id, user_id")
      .eq("id", workflowId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (workflowLookupError) {
      console.error("Workflow lookup error:", workflowLookupError);
      return NextResponse.json(
        {
          error:
            workflowLookupError.message || "Unable to verify workflow.",
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

    const uploadedPaths: string[] = [];
    const insertedContentIds: string[] = [];

    try {
      for (const file of files) {
        const extension = getExtension(file);
        const contentCategory = getContentCategory(file);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileHash = crypto
          .createHash("sha256")
          .update(buffer)
          .digest("hex");

        const { data: existingDup } = await supabaseAdmin
          .from("content")
          .select("id")
          .eq("workflow_id", workflowId)
          .eq("file_hash", fileHash)
          .limit(1)
          .maybeSingle();

        if (existingDup?.id) {
          throw new Error(
            `DUPLICATE_FILE:${existingDup.id}:${file.name}`
          );
        }

        const fileName = `${user.id}/${workflowId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("postoll-media")
          .upload(fileName, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
            cacheControl: "3600",
          });

        if (uploadError) {
          throw new Error(
            uploadError.message || `Failed to upload file: ${file.name}`
          );
        }

        uploadedPaths.push(fileName);

        const { data: publicUrlData } = supabaseAdmin.storage
          .from("postoll-media")
          .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        const { data: contentRow, error: contentError } = await supabaseAdmin
          .from("content")
          .insert({
            user_id: user.id,
            workflow_id: workflowId,
            type: contentCategory,
            platform: null,
            title: null,
            idea: null,
            concept: null,
            creative_intent: null,
            image_direction: null,
            plan: null,
            image_url: publicUrl,
            file_hash: fileHash,
            caption: uploadDescription,
            hashtags: [],
            status: "queued",
            published_at: null,
          })
          .select()
          .single();

        if (contentError) {
          throw new Error(
            contentError.message ||
              `Failed to save content for file: ${file.name}`
          );
        }

        insertedContentIds.push(contentRow.id);
      }
    } catch (innerError) {
      if (insertedContentIds.length > 0) {
        await supabaseAdmin
          .from("content")
          .delete()
          .in("id", insertedContentIds);
      }

      if (uploadedPaths.length > 0) {
        await supabaseAdmin.storage
          .from("postoll-media")
          .remove(uploadedPaths);
      }

      const rawMessage =
        innerError instanceof Error
          ? innerError.message
          : "Unable to save uploaded content.";

      if (rawMessage.startsWith("DUPLICATE_FILE:")) {
        const [, duplicateId, dupFileName] = rawMessage.split(":");
        return NextResponse.json(
          {
            error: `Duplicate file detected (${dupFileName || "file"}) already exists in this workflow.`,
            duplicateContentId: duplicateId || null,
          },
          { status: 409 }
        );
      }

      console.error("Upload content rollback triggered:", rawMessage);

      return NextResponse.json({ error: rawMessage }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contentIds: insertedContentIds,
    });
  } catch (error) {
    console.error("Upload content API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save uploaded content.",
      },
      { status: 500 }
    );
  }
}

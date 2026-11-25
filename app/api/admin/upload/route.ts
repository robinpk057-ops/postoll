import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isSameOrigin,
  recordAdminAudit,
  verifyAdminRequest,
} from "@/lib/security/guards";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File size must be between 1 byte and 50 MB" },
      { status: 400 }
    );
  }

  const safeExt = (file.name.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const objectPath = `admin/${auth.actor.userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt || "bin"}`;

  const arrayBuffer = await file.arrayBuffer();
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(objectPath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("public-assets").getPublicUrl(objectPath);

  await recordAdminAudit({
    actorUserId: auth.actor.userId,
    action: "cms.media.upload",
    targetType: "storage_object",
    targetId: objectPath,
    details: { mimeType: file.type, sizeBytes: file.size },
  });

  return NextResponse.json({ url: publicUrl, path: objectPath });
}

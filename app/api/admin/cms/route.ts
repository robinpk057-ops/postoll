import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isSameOrigin,
  recordAdminAudit,
  verifyAdminRequest,
} from "@/lib/security/guards";

const ALLOWED_KEYS = new Set(["home.hero", "home.stats", "app.banner"]);

export async function GET(request: Request) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  void request;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("section_key, page_slug, label, content, updated_at")
    .order("section_key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data ?? [] });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as {
    section_key?: unknown;
    content?: unknown;
  };

  if (typeof payload.section_key !== "string" || !ALLOWED_KEYS.has(payload.section_key)) {
    return NextResponse.json({ error: "Unsupported section_key" }, { status: 400 });
  }

  if (!payload.content || typeof payload.content !== "object" || Array.isArray(payload.content)) {
    return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_content")
    .update({
      content: payload.content,
      updated_at: new Date().toISOString(),
      updated_by: auth.actor.userId,
    })
    .eq("section_key", payload.section_key)
    .select("section_key, page_slug, label, content, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAdminAudit({
    actorUserId: auth.actor.userId,
    action: "cms.section.update",
    targetType: "site_content",
    targetId: payload.section_key,
    details: { updatedKeys: Object.keys(payload.content as Record<string, unknown>) },
  });

  revalidatePath("/");
  revalidatePath("/admin");

  return NextResponse.json({ section: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type {
  RecentAngleEntry,
  WorkflowDirectorSettings,
} from "@/app/types/ai-director";

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const workflowId: string | undefined = body?.workflowId;
    const settings: Partial<WorkflowDirectorSettings> | undefined = body?.settings;

    if (!workflowId || !settings) {
      return NextResponse.json(
        { error: "Both 'workflowId' and 'settings' are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const updatePayload: Record<string, unknown> = {};
    if (settings.content_format !== undefined) {
      updatePayload.content_format = settings.content_format;
    }
    if (settings.visual_style !== undefined) {
      updatePayload.visual_style = settings.visual_style;
    }
    if (settings.audio_mode !== undefined) {
      updatePayload.audio_mode = settings.audio_mode;
    }
    if (settings.aspect_ratio !== undefined) {
      updatePayload.aspect_ratio = settings.aspect_ratio;
    }
    if (settings.duration_seconds !== undefined) {
      updatePayload.duration_seconds = settings.duration_seconds;
    }
    if (settings.detailed_brief !== undefined) {
      updatePayload.detailed_brief = settings.detailed_brief;
    }
    if (settings.reference_assets !== undefined) {
      updatePayload.reference_assets = settings.reference_assets;
    }
    if (settings.style_blueprint !== undefined) {
      updatePayload.style_blueprint = settings.style_blueprint;
    }
    if (settings.voice_config !== undefined) {
      updatePayload.voice_config = settings.voice_config;
    }
    if (settings.auto_publish !== undefined) {
      updatePayload.auto_publish = settings.auto_publish;
    }
    if (settings.recent_angles !== undefined) {
      updatePayload.recent_angles = settings.recent_angles;
    }

    const { data, error } = await supabase
      .from("workflows")
      .update(updatePayload)
      .eq("id", workflowId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      workflow: data,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update workflow settings.";
    console.error("[PATCH /api/ai-director/workflow] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workflowId: string | undefined = body?.workflowId;
    const angleEntry: RecentAngleEntry | undefined = body?.angleEntry;

    if (!workflowId || !angleEntry?.hook || !angleEntry?.angleSummary) {
      return NextResponse.json(
        {
          error:
            "'workflowId' and 'angleEntry' (with hook and angleSummary) are required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from("workflows")
      .select("recent_angles")
      .eq("id", workflowId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    const currentAngles: RecentAngleEntry[] = Array.isArray(existing?.recent_angles)
      ? existing.recent_angles
      : [];

    const normalizedEntry: RecentAngleEntry = {
      date: angleEntry.date || new Date().toISOString().slice(0, 10),
      hook: angleEntry.hook,
      angleSummary: angleEntry.angleSummary,
    };

    const nextAngles = [...currentAngles, normalizedEntry].slice(-30);

    const { data: updated, error: updateError } = await supabase
      .from("workflows")
      .update({ recent_angles: nextAngles })
      .eq("id", workflowId)
      .select("id, recent_angles")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      recent_angles: updated.recent_angles,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to append recent angle.";
    console.error("[POST /api/ai-director/workflow] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

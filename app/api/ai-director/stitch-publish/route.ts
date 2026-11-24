import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateSafetyText } from "@/lib/safety-guardrail";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const jobId = String(body?.jobId || "");
    const selectedAccountIds: string[] = Array.isArray(body?.targetAccountIds)
      ? body.targetAccountIds.map(String)
      : [];

    const { data: job, error: jobErr } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Generation job not found" }, { status: 404 });
    }

    const scenes = Array.isArray(job.storyboard_json?.scenes) ? job.storyboard_json.scenes : [];
    const combinedScript = scenes
      .map((s: { narration?: string; visualPrompt?: string }, i: number) =>
        `Clip ${i + 1}: ${s.narration || ""} (${s.visualPrompt || ""})`
      )
      .join("\n");

    const safety = validateSafetyText(
      `${job.storyboard_json?.caption || ""}\n${combinedScript}`
    );
    if (!safety.allowed) {
      return NextResponse.json({ error: safety.reason }, { status: 400 });
    }

    const accountIdsToUse =
      selectedAccountIds.length > 0
        ? selectedAccountIds
        : Array.isArray(job.target_account_ids)
        ? job.target_account_ids
        : [];

    const stitchedClips = scenes.map((s: any, idx: number) => ({
      clipIndex: idx,
      sceneNumber: idx + 1,
      durationSeconds: s.durationSeconds || 10,
      visualPrompt: s.visualPrompt || "",
      narration: s.narration || "",
      combinedOrder: idx + 1,
    }));

    const { data: updatedJob, error: updErr } = await supabase
      .from("generation_jobs")
      .update({
        approval_status: "approved",
        status: "published",
        target_account_ids: accountIdsToUse,
        clips_json: stitchedClips,
        final_video_url:
          job.final_video_url || `stitched://job/${job.id}/combined-clips.mp4`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (updErr) {
      throw new Error(updErr.message);
    }

    if (job.output_post_id) {
      await supabase
        .from("content")
        .update({
          status: "published",
          approval_status: "approved",
          target_account_ids: accountIdsToUse,
        })
        .eq("id", job.output_post_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      ok: true,
      job: updatedJob,
      stitchedClipCount: stitchedClips.length,
      publishedAccountIds: accountIdsToUse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stitch and publish.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

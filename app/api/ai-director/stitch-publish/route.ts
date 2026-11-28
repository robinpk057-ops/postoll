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

    if (!jobId) {
      return NextResponse.json({ error: "'jobId' is required" }, { status: 400 });
    }

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
      .map((s: { narration?: string; narrationOrOverlayText?: string; visualPrompt?: string }, i: number) =>
        `Clip ${i + 1}: ${s.narration || s.narrationOrOverlayText || ""} (${s.visualPrompt || ""})`
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

    const stitchedClips = scenes.map((s: Record<string, unknown>, idx: number) => ({
      clipIndex: idx,
      sceneNumber: idx + 1,
      durationSeconds: Number(s.durationSeconds) || 10,
      visualPrompt: String(s.visualPrompt || ""),
      narration: String(s.narration || s.narrationOrOverlayText || ""),
      mediaUrl: typeof s.videoUrl === "string" ? s.videoUrl : typeof s.imageUrl === "string" ? s.imageUrl : null,
      combinedOrder: idx + 1,
    }));

    const hasRealMedia =
      typeof job.final_video_url === "string" &&
      (job.final_video_url.startsWith("http://") || job.final_video_url.startsWith("https://"));

    const nextJobStatus = hasRealMedia ? "published" : "ready_for_review";
    const nextContentStatus = hasRealMedia ? "published" : "draft";

    const { data: updatedJob, error: updErr } = await supabase
      .from("generation_jobs")
      .update({
        approval_status: hasRealMedia ? "approved" : "pending_media",
        status: nextJobStatus,
        target_account_ids: accountIdsToUse,
        clips_json: stitchedClips,
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
          status: nextContentStatus,
          approval_status: hasRealMedia ? "approved" : "pending_review",
          target_account_ids: accountIdsToUse,
        })
        .eq("id", job.output_post_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      ok: true,
      hasRealMedia,
      job: updatedJob,
      stitchedClipCount: stitchedClips.length,
      publishedAccountIds: accountIdsToUse,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stitch and publish.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
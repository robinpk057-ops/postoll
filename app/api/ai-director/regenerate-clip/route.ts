import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import {
  assertGeminiResponseSafe,
  STRICT_GEMINI_SAFETY_SETTINGS,
  validateSafetyText,
} from "@/lib/safety-guardrail";

export async function POST(req: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let jobId: string | null = null;
  let chargedClip = false;

  try {
    supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    jobId = String(body?.jobId || "");
    const sceneIndex = Number(body?.sceneIndex);
    const visualPrompt = String(body?.visualPrompt || "").trim();
    const narration = String(body?.narration || "").trim();
    const durationSeconds = Number(body?.durationSeconds || 10);

    const safetyCheck = validateSafetyText(`${visualPrompt}\n${narration}`);
    if (!safetyCheck.allowed) {
      return NextResponse.json({ error: safetyCheck.reason }, { status: 400 });
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

    const { data: deductRows, error: deductErr } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: 1,
      p_reason: "clip_regeneration",
      p_job_id: jobId,
      p_note: `Regenerate clip ${sceneIndex + 1}`,
    });

    const deductResult = Array.isArray(deductRows) ? deductRows[0] : deductRows;
    if (deductErr || !deductResult?.ok) {
      return NextResponse.json(
        { error: deductResult?.message || "Insufficient credits for clip regeneration." },
        { status: 402 }
      );
    }
    chargedClip = true;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Refine a single short-form video clip (Scene ${sceneIndex + 1}, ${durationSeconds}s).
Visual Prompt: ${visualPrompt}
Narration: ${narration}
Return JSON with { "visualPrompt": string, "narration": string, "clipNotes": string }.`,
      config: {
        responseMimeType: "application/json",
        safetySettings: STRICT_GEMINI_SAFETY_SETTINGS,
      },
    });

    assertGeminiResponseSafe(response);
    const parsed = JSON.parse(response.text || "{}");

    const storyboard = { ...(job.storyboard_json || {}) };
    const scenes = Array.isArray(storyboard.scenes) ? [...storyboard.scenes] : [];
    scenes[sceneIndex] = {
      ...(scenes[sceneIndex] || {}),
      sceneNumber: sceneIndex + 1,
      visualPrompt: parsed.visualPrompt || visualPrompt,
      narration: parsed.narration || narration,
      durationSeconds,
      regeneratedAt: new Date().toISOString(),
    };
    storyboard.scenes = scenes;

    const clips = Array.isArray(job.clips_json) ? [...job.clips_json] : [];
    clips[sceneIndex] = {
      clipIndex: sceneIndex,
      sceneNumber: sceneIndex + 1,
      durationSeconds,
      visualPrompt: parsed.visualPrompt || visualPrompt,
      narration: parsed.narration || narration,
      status: "ready",
      updatedAt: new Date().toISOString(),
    };

    const { data: updatedJob, error: updateErr } = await supabase
      .from("generation_jobs")
      .update({
        storyboard_json: storyboard,
        clips_json: clips,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return NextResponse.json({
      ok: true,
      job: updatedJob,
      remainingCredits: deductResult.remaining_credits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clip regeneration failed.";
    if (supabase && jobId && chargedClip) {
      await supabase.rpc("refund_job_credits", {
        p_job_id: jobId,
        p_note: `Refund after clip regeneration error: ${message}`,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

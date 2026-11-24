import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import type {
  RecentAngleEntry,
  WorkflowDirectorSettings,
} from "@/app/types/ai-director";
import type { StoryboardPlan } from "@/app/api/ai-director/storyboard/route";

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

const storyboardResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    angleSummary: { type: Type.STRING },
    hook: { type: Type.STRING },
    characterAndVisualAnchor: { type: Type.STRING },
    voiceoverScript: { type: Type.STRING },
    caption: { type: Type.STRING },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.INTEGER },
          startSec: { type: Type.INTEGER },
          endSec: { type: Type.INTEGER },
          visualPrompt: { type: Type.STRING },
          motionOrCameraNote: { type: Type.STRING },
          narrationOrOverlayText: { type: Type.STRING },
          usesProductOrCharacterRef: { type: Type.BOOLEAN },
        },
        required: [
          "sceneNumber",
          "startSec",
          "endSec",
          "visualPrompt",
          "motionOrCameraNote",
          "narrationOrOverlayText",
          "usesProductOrCharacterRef",
        ],
      },
    },
  },
  required: [
    "angleSummary",
    "hook",
    "characterAndVisualAnchor",
    "voiceoverScript",
    "caption",
    "hashtags",
    "scenes",
  ],
};

function buildDailyPrompt(settings: WorkflowDirectorSettings): string {
  const lockedRefs = (settings.reference_assets || []).filter(
    (a) => a.lockAcrossRuns && a.kind !== "style_example"
  );
  const recentHooks = (settings.recent_angles || [])
    .slice(-20)
    .map(
      (entry, idx) =>
        `${idx + 1}. [${entry.date}] ${entry.hook} — ${entry.angleSummary}`
    )
    .join("\n");

  const styleBlueprintText = settings.style_blueprint
    ? JSON.stringify(settings.style_blueprint)
    : "None provided; infer pacing and framing best suited to the platform and visual style.";

  const brief = settings.detailed_brief || {
    goal: "",
    coreIdea: "",
    charactersAndTone: "",
    pacingAndCta: "",
  };

  return [
    "You are an expert social media creative director and scriptwriter.",
    "Generate a fresh, high-retention daily content storyboard in JSON matching the response schema.",
    "",
    "WORKFLOW CONFIGURATION:",
    `- Content Format: ${settings.content_format}`,
    `- Visual Style: ${settings.visual_style}`,
    `- Audio Mode: ${settings.audio_mode}`,
    `- Aspect Ratio: ${settings.aspect_ratio}`,
    `- Target Duration (seconds, if video): ${settings.duration_seconds}`,
    `- Language: ${settings.voice_config?.language || "en"}`,
    `- Voice Preset: ${settings.voice_config?.preset || "warm_clear"}`,
    "",
    "USER DETAILED BRIEF:",
    `- Goal: ${brief.goal || "Engage audience and drive meaningful action"}`,
    `- Core Idea / Niche: ${brief.coreIdea || "General daily content"}`,
    `- Characters, Brand & Tone: ${brief.charactersAndTone || "Consistent, natural, relatable"}`,
    `- Pacing & Call to Action: ${brief.pacingAndCta || "Strong opening hook, clear payoff, natural CTA"}`,
    `- Story Arc Notes (for multi-part/serialized stories): ${brief.storyArcNotes || "Standalone daily episode unless specified"}`,
    `- Rules to Avoid: ${brief.avoidRules || "No cliches, no robotic filler, no repetitive phrasing"}`,
    "",
    "LOCKED PRODUCT / CHARACTER REFERENCE ASSETS:",
    lockedRefs.length > 0
      ? lockedRefs
          .map(
            (r) => `- (${r.kind}) ${r.label || "Reference"}: ${r.url}`
          )
          .join("\n")
      : "- None uploaded; define a clear, consistent character/product description in characterAndVisualAnchor.",
    "",
    "STYLE & PACING BLUEPRINT (from user inspiration examples):",
    styleBlueprintText,
    "",
    "RECENT ANGLES TO AVOID REPEATING:",
    recentHooks || "- None yet (first run).",
    "",
    "GENERATION RULES:",
    "1. Produce a brand-new hook and angle distinct from RECENT ANGLES.",
    "2. Keep character appearance, product traits, and visual style consistent across every scene.",
    "3. If content_format is 'video', cover 0 to duration_seconds in logical sequential scenes (e.g. 5s hook + 5s-10s beats for 30s) and match voiceoverScript length naturally to duration_seconds (roughly 2-2.5 words per second when audio_mode uses voice).",
    "4. If audio_mode is 'music_only' or 'none', keep voiceoverScript empty or concise overlay/caption guidance only.",
    "5. If content_format is 'image' or 'carousel', represent each slide/frame as a numbered scene entry (startSec/endSec = 0) and write clean caption + hashtags.",
    "6. Return 4 to 8 relevant hashtags without leading # duplicates or empty strings.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  let jobId: string | null = null;
  let supabase: ReturnType<typeof getSupabaseServerClient> | null = null;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
    let sessionUserId: string | null = null;

    if (!isCronAuthorized) {
      const sessionSupabase = await createSessionClient();
      const { data: { user } } = await sessionSupabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      sessionUserId = user.id;
    }


    const body = await req.json();
    const workflowId: string | undefined = body?.workflowId;
    const runDate: string =
      body?.runDate || new Date().toISOString().slice(0, 10);

    if (!workflowId) {
      return NextResponse.json(
        { error: "'workflowId' is required." },
        { status: 400 }
      );
    }

    supabase = getSupabaseServerClient();

    // 1. Fetch workflow configuration
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json(
        { error: wfError?.message || "Workflow not found." },
        { status: 404 }
      );
    }
    if (sessionUserId && workflow.user_id !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }


    const userId: string | undefined = workflow.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: "Workflow is missing 'user_id'." },
        { status: 400 }
      );
    }

    // 2. Idempotency check on public.generation_jobs for (workflow_id, run_date)
    const { data: existingJob } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("run_date", runDate)
      .maybeSingle();

    if (existingJob && existingJob.status !== "failed") {
      return NextResponse.json({
        ok: true,
        deduplicated: true,
        job: existingJob,
      });
    }

    if (existingJob && existingJob.status === "failed") {
      jobId = existingJob.id;
      await supabase
        .from("generation_jobs")
        .update({
          status: "scripting",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    } else {
      const { data: insertedJob, error: jobInsertError } = await supabase
        .from("generation_jobs")
        .insert({
          workflow_id: workflowId,
          user_id: userId,
          run_date: runDate,
          status: "scripting",
          credits_charged: 1,
        })
        .select("*")
        .single();

      if (jobInsertError || !insertedJob) {
        return NextResponse.json(
          { error: jobInsertError?.message || "Failed to create generation job." },
          { status: 400 }
        );
      }
      jobId = insertedJob.id;
    }

    // 3. Build settings & generate storyboard via Gemini
    const settings: WorkflowDirectorSettings = {
      id: workflow.id,
      content_format: workflow.content_format || "video",
      visual_style: workflow.visual_style || "brand",
      audio_mode: workflow.audio_mode || "voiceover_music",
      aspect_ratio: workflow.aspect_ratio || "9:16",
      duration_seconds: workflow.duration_seconds || 30,
      detailed_brief: workflow.detailed_brief || {
        goal: "",
        coreIdea: "",
        charactersAndTone: "",
        pacingAndCta: "",
      },
      reference_assets: Array.isArray(workflow.reference_assets)
        ? workflow.reference_assets
        : [],
      style_blueprint: workflow.style_blueprint || null,
      voice_config: workflow.voice_config || {
        language: "en",
        preset: "warm_clear",
      },
      auto_publish:
        typeof workflow.auto_publish === "boolean" ? workflow.auto_publish : true,
      recent_angles: Array.isArray(workflow.recent_angles)
        ? workflow.recent_angles
        : [],
    };

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildDailyPrompt(settings);

    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ];
    let response;
    let lastGenError: unknown;
    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: storyboardResponseSchema,
            },
          });
          break;
        } catch (genErr: unknown) {
          lastGenError = genErr;
          const msg = (
            genErr instanceof Error ? genErr.message : String(genErr)
          ).toLowerCase();
          const isTransient =
            msg.includes("503") ||
            msg.includes("unavailable") ||
            msg.includes("429") ||
            msg.includes("resource_exhausted") ||
            msg.includes("high demand") ||
            msg.includes("overloaded") ||
            msg.includes("fetch failed");
          if (!isTransient || attempt === 3) {
            break;
          }
          const backoffMs = 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
      if (response) break;
    }
    if (!response) {
      throw lastGenError || new Error("All Gemini models returned high demand / unavailable.");
    }

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Gemini returned an empty storyboard response.");
    }

    const storyboard: StoryboardPlan = JSON.parse(rawText);

    // 4. Commit today's hook/angle into workflows.recent_angles
    const newAngle: RecentAngleEntry = {
      date: runDate,
      hook: storyboard.hook,
      angleSummary: storyboard.angleSummary,
    };
    const nextRecentAngles = [...settings.recent_angles, newAngle].slice(-30);

    const { error: angleUpdateError } = await supabase
      .from("workflows")
      .update({ recent_angles: nextRecentAngles })
      .eq("id", workflowId);

    if (angleUpdateError) {
      throw new Error(`Failed to update recent_angles: ${angleUpdateError.message}`);
    }

    // 5. Create content entry in public.content if table/columns match
    let outputPostId: string | null = null;
    const hashtagLine = storyboard.hashtags
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .join(" ");
    const fullCaption = hashtagLine
      ? `${storyboard.caption}\n\n${hashtagLine}`
      : storyboard.caption;

    const { data: createdContent, error: contentError } = await supabase
      .from("content")
      .insert({
        user_id: userId,
        workflow_id: workflow.id,
        title: storyboard.hook.slice(0, 120),
        caption: fullCaption,
        hashtags: Array.isArray(storyboard.hashtags) ? storyboard.hashtags : [],
        status: settings.auto_publish ? "queued" : "draft",
      })
      .select("id")
      .single();

    if (contentError) {
      console.error("[POST /api/ai-director/run-daily] content insert warning:", contentError.message);
    }

    if (!contentError && createdContent?.id) {
      outputPostId = createdContent.id;
    }

    // 6. Mark generation job completed
    const { data: completedJob, error: completeError } = await supabase
      .from("generation_jobs")
      .update({
        status: "completed",
        storyboard_json: storyboard,
        output_post_id: outputPostId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (completeError) {
      throw new Error(`Failed to finalize generation job: ${completeError.message}`);
    }

    return NextResponse.json({
      ok: true,
      deduplicated: false,
      job: completedJob,
      storyboard,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Daily generation job failed.";
    console.error("[POST /api/ai-director/run-daily] error:", message);

    if (supabase && jobId) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}





import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import type { WorkflowDirectorSettings } from "@/app/types/ai-director";

export interface StoryboardScene {
  sceneNumber: number;
  startSec: number;
  endSec: number;
  visualPrompt: string;
  motionOrCameraNote: string;
  narrationOrOverlayText: string;
  usesProductOrCharacterRef: boolean;
}

export interface StoryboardPlan {
  angleSummary: string;
  hook: string;
  characterAndVisualAnchor: string;
  voiceoverScript: string;
  caption: string;
  hashtags: string[];
  scenes: StoryboardScene[];
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

function buildStoryboardPrompt(settings: WorkflowDirectorSettings): string {
  const lockedRefs = (settings.reference_assets || []).filter(
    (a) => a.lockAcrossRuns && a.kind !== "style_example"
  );
  const recentHooks = (settings.recent_angles || [])
    .slice(-20)
    .map((entry, idx) => `${idx + 1}. [${entry.date}] ${entry.hook} — ${entry.angleSummary}`)
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
          .map((r) => `- (${r.kind}) ${r.label || "Reference"}: ${r.url}`)
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
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const settings: WorkflowDirectorSettings | undefined = body?.settings;

    if (!settings || !settings.content_format || !settings.visual_style) {
      return NextResponse.json(
        { error: "Invalid request: 'settings' with content_format and visual_style is required." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildStoryboardPrompt(settings);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: storyboardResponseSchema,
        temperature: 0.7,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty storyboard response." },
        { status: 502 }
      );
    }

    const storyboard: StoryboardPlan = JSON.parse(rawText);

    return NextResponse.json({
      ok: true,
      storyboard,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate storyboard.";
    console.error("[POST /api/ai-director/storyboard] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;
type SupportedAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

type SimplifiedScene = {
  scene: number;
  description?: string;
  duration?: string;
};

type DetailedScene = {
  scene?: number;
  scenePurpose?: string;
  storyBeat?: string;
  description?: string;
  duration?: string;
  generationUnit?: number;
  shotType?: string;
  camera?: string;
  cameraMovement?: string;
  composition?: string;
  environment?: string;
  characters?: unknown;
  characterAction?: string;
  importantObjects?: unknown;
  lighting?: string;
  mood?: string;
  audio?: string;
  musicMoment?: string;
  soundEffects?: unknown;
  dialogue?: string;
  continuityFromPrevious?: string;
  continuityToNext?: string;
  startState?: string;
  endState?: string;
  transition?: string;
  visualPriority?: string;
  generationPrompt?: string;
  negativePrompt?: string;
  [key: string]: unknown;
};

type CharacterBibleItem = Record<string, unknown>;
type ObjectBibleItem = Record<string, unknown>;

type EnvironmentBible = {
  primaryEnvironment?: string;
  stableElements?: unknown[];
  variableElements?: unknown[];
  intentionalChanges?: unknown[];
  [key: string]: unknown;
};

type CinematographyBible = Record<string, unknown>;
type AudioBible = Record<string, unknown>;

type ContinuityRules = {
  character?: unknown[];
  environment?: unknown[];
  objects?: unknown[];
  lighting?: unknown[];
  time?: unknown[];
  camera?: unknown[];
  action?: unknown[];
  emotion?: unknown[];
  audio?: unknown[];
  color?: unknown[];
  allowedChanges?: unknown[];
  [key: string]: unknown;
};

type ReelProduction = {
  required?: boolean;
  duration?: string | null;
  targetGenerationResolution?: string;
  generationUnitDuration?: string;
  generationStrategy?: string;
  hook?: string;
  storyPremise?: string;
  emotionalProgression?: string;
  beginning?: string;
  middle?: string;
  ending?: string;
  finalPayoff?: string;
  characterBible?: CharacterBibleItem[];
  environmentBible?: EnvironmentBible;
  objectBible?: ObjectBibleItem[];
  cinematographyBible?: CinematographyBible;
  audioBible?: AudioBible;
  continuityRules?: ContinuityRules;
  referenceAssets?: unknown[];
  scenes?: DetailedScene[];
};

type VisualStrategy = {
  subjectType?: string;
  mainSubject?: string;
  secondarySubjects?: string[];
  environment?: string;
  action?: string;
  mood?: string;
  visualStyle?: string;
  lighting?: string;
  composition?: string;
  camera?: string;
  colorDirection?: string;
};

type GenerateReelRequest = {
  plan: {
    originalRequest?: string;
    title?: string;
    concept?: string;
    creativeIntent?: string;
    visualStrategy?: VisualStrategy;
    reelProduction?: ReelProduction;
    scenes?: SimplifiedScene[];
  };
  scene?: SimplifiedScene;
  reelDuration?: "15" | "30";
  aspectRatio?: SupportedAspectRatio;
  hasReferenceImage?: boolean;
};

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured. Add it to .env.local."
    );
  }
  return apiKey;
}

function prettyJson(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function findDetailedScene(
  plan: GenerateReelRequest["plan"],
  requestedScene: SimplifiedScene
): DetailedScene {
  const detailedScenes = plan.reelProduction?.scenes ?? [];
  const match = detailedScenes.find(
    (scene) => Number(scene.scene) === Number(requestedScene.scene)
  );
  if (match) return match;

  return {
    scene: requestedScene.scene,
    description: requestedScene.description ?? "",
    duration: requestedScene.duration ?? "8 seconds",
    scenePurpose: "",
    storyBeat: "",
    generationUnit: requestedScene.scene,
    shotType: "",
    camera: "",
    cameraMovement: "",
    composition: "",
    environment: "",
    characters: [],
    characterAction: "",
    importantObjects: [],
    lighting: "",
    mood: "",
    audio: "",
    musicMoment: "",
    soundEffects: [],
    dialogue: "",
    continuityFromPrevious: "",
    continuityToNext: "",
    startState: "",
    endState: "",
    transition: "",
    visualPriority: "",
    generationPrompt: requestedScene.description ?? "",
    negativePrompt: "",
  };
}

function findPreviousScene(
  plan: GenerateReelRequest["plan"],
  sceneNumber: number
): DetailedScene | null {
  const scenes = plan.reelProduction?.scenes ?? [];
  return scenes.find((scene) => Number(scene.scene) === sceneNumber - 1) ?? null;
}

function findNextScene(
  plan: GenerateReelRequest["plan"],
  sceneNumber: number
): DetailedScene | null {
  const scenes = plan.reelProduction?.scenes ?? [];
  return scenes.find((scene) => Number(scene.scene) === sceneNumber + 1) ?? null;
}

function buildScenePrompt(
  plan: GenerateReelRequest["plan"],
  scene: DetailedScene,
  previousScene: DetailedScene | null,
  nextScene: DetailedScene | null,
  reelDuration: "15" | "30",
  aspectRatio: SupportedAspectRatio,
  hasReferenceImage: boolean
): string {
  const production = plan.reelProduction;
  const visual = plan.visualStrategy;
  const sceneNumber = Number(scene.scene ?? 1);

  return `
POSTOLL — PROFESSIONAL AI VIDEO PRODUCTION PROMPT

Generate ONE cinematic video generation unit belonging to a larger
${reelDuration}-second social-media film.

Aspect ratio: ${aspectRatio}.
Target generation duration: approximately 8 seconds.
Reference image attached: ${hasReferenceImage ? "Yes" : "No"}.

==================================================
ORIGINAL USER REQUEST
==================================================
${plan.originalRequest ?? ""}

==================================================
TITLE & CONCEPT
==================================================
Title: ${plan.title ?? ""}
Concept: ${plan.concept ?? ""}
Creative intent: ${plan.creativeIntent ?? ""}

==================================================
STORY ARC
==================================================
Hook: ${production?.hook ?? ""}
Story premise: ${production?.storyPremise ?? ""}
Emotional progression: ${production?.emotionalProgression ?? ""}
Beginning: ${production?.beginning ?? ""}
Middle: ${production?.middle ?? ""}
Ending: ${production?.ending ?? ""}
Final payoff: ${production?.finalPayoff ?? ""}

==================================================
CONTINUITY & VISUAL DIRECTION
==================================================
Characters: ${prettyJson(production?.characterBible ?? [])}
Environment: ${prettyJson(production?.environmentBible ?? {})}
Cinematography: ${prettyJson(production?.cinematographyBible ?? {})}
Audio: ${prettyJson(production?.audioBible ?? {})}
Visual strategy: ${prettyJson(visual ?? {})}

==================================================
SCENE ${sceneNumber} DETAILS
==================================================
Description: ${scene.description ?? ""}
Duration: ${scene.duration ?? "8 seconds"}
Camera: ${scene.camera ?? ""}
Camera movement: ${scene.cameraMovement ?? ""}
Lighting: ${scene.lighting ?? ""}
Mood: ${scene.mood ?? ""}
Start state: ${scene.startState ?? ""}
End state: ${scene.endState ?? ""}
Previous scene: ${previousScene ? prettyJson(previousScene) : "First scene"}
Next scene: ${nextScene ? prettyJson(nextScene) : "Final scene"}
Generation prompt: ${scene.generationPrompt ?? ""}
Negative prompt: ${scene.negativePrompt ?? ""}
`.trim();
}

async function createVideoJob(
  apiKey: string,
  prompt: string,
  aspectRatio: SupportedAspectRatio
): Promise<string> {
  const model =
    process.env.OPENROUTER_VIDEO_MODEL || "bytedance-seed/seedance-2.0-mini";

  const response = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
      "X-Title": "Postoll",
    },
    body: JSON.stringify({
      model,
      prompt,
      duration: 8,
      aspect_ratio: aspectRatio,
    }),
  });

  const rawText = await response.text();
  let data: JsonObject = {};
  try {
    data = JSON.parse(rawText) as JsonObject;
  } catch {
    throw new Error(`OpenRouter returned invalid JSON. HTTP ${response.status}`);
  }

  if (!response.ok) {
    const errorObject =
      typeof data.error === "object" && data.error !== null
        ? (data.error as Record<string, unknown>)
        : null;
    const message =
      typeof errorObject?.message === "string"
        ? errorObject.message
        : `OpenRouter video request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  const jobId =
    typeof data.id === "string"
      ? data.id
      : typeof data.job_id === "string"
      ? data.job_id
      : null;

  if (!jobId) {
    throw new Error(
      "OpenRouter accepted the request but did not return a video job ID."
    );
  }

  return jobId;
}

async function waitForVideoJob(
  apiKey: string,
  jobId: string
): Promise<JsonObject> {
  const maxAttempts = 90;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const rawText = await response.text();
    let data: JsonObject = {};
    try {
      data = JSON.parse(rawText) as JsonObject;
    } catch {
      throw new Error(
        `OpenRouter returned invalid JSON while checking video job. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `OpenRouter video status request failed with HTTP ${response.status}.`
      );
    }

    const status =
      typeof data.status === "string" ? data.status.toLowerCase() : "";

    if (
      status === "completed" ||
      status === "complete" ||
      status === "succeeded" ||
      status === "success"
    ) {
      return data;
    }

    if (
      status === "failed" ||
      status === "error" ||
      status === "cancelled" ||
      status === "canceled"
    ) {
      const errorObject =
        typeof data.error === "object" && data.error !== null
          ? (data.error as Record<string, unknown>)
          : null;
      const message =
        typeof errorObject?.message === "string"
          ? errorObject.message
          : "OpenRouter video generation failed.";
      throw new Error(message);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error("Video generation timed out. Please try again.");
}

function extractVideoUrl(result: JsonObject): string | null {
  const directCandidates: unknown[] = [
    result.video_url,
    result.url,
    result.download_url,
    result.output,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string") return candidate;
  }

  const video =
    typeof result.video === "object" && result.video !== null
      ? (result.video as Record<string, unknown>)
      : null;
  if (video) {
    for (const candidate of [video.url, video.video_url, video.download_url]) {
      if (typeof candidate === "string") return candidate;
    }
  }

  const output = Array.isArray(result.output) ? result.output : null;
  if (output) {
    for (const item of output) {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        for (const candidate of [obj.url, obj.video_url, obj.download_url]) {
          if (typeof candidate === "string") return candidate;
        }
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const { requireAuthenticatedUser } = await import("@/lib/api-guard");
  const { checkAndDeductCredits } = await import("@/lib/billing/credits");
  const auth = await requireAuthenticatedUser(request, { routeName: "generate-reel", maxRequests: 20, windowMs: 60_000 });
  if (!auth.ok) return auth.response;
  const creditRes = await checkAndDeductCredits({ userId: auth.user.id, cost: 2, endpoint: "/api/generate-reel", provider: "openrouter_video" });
  if (!creditRes.ok) return creditRes.response;
  try {
    const body = (await request.json()) as GenerateReelRequest;

    if (!body.plan) {
      return NextResponse.json(
        { success: false, error: "A creative plan is required." },
        { status: 400 }
      );
    }

    if (!body.scene) {
      return NextResponse.json(
        { success: false, error: "A reel scene is required." },
        { status: 400 }
      );
    }

    const reelDuration: "15" | "30" =
      body.reelDuration === "30" ? "30" : "15";
    const aspectRatio: SupportedAspectRatio =
      body.aspectRatio && ["1:1", "9:16", "16:9", "4:5"].includes(body.aspectRatio)
        ? body.aspectRatio
        : "9:16";
    const hasReferenceImage = Boolean(body.hasReferenceImage);

    const sceneNumber = Number(body.scene.scene);
    if (!Number.isFinite(sceneNumber)) {
      return NextResponse.json(
        { success: false, error: "Invalid reel scene number." },
        { status: 400 }
      );
    }

    const detailedScene = findDetailedScene(body.plan, body.scene);
    const previousScene = findPreviousScene(body.plan, sceneNumber);
    const nextScene = findNextScene(body.plan, sceneNumber);

    const prompt = buildScenePrompt(
      body.plan,
      detailedScene,
      previousScene,
      nextScene,
      reelDuration,
      aspectRatio,
      hasReferenceImage
    );

    const apiKey = getOpenRouterApiKey();
    const jobId = await createVideoJob(apiKey, prompt, aspectRatio);
    const result = await waitForVideoJob(apiKey, jobId);
    const videoUrl = extractVideoUrl(result);

    if (!videoUrl) {
      throw new Error(
        "Video generation completed, but OpenRouter did not return a playable video URL."
      );
    }

    return NextResponse.json({
      success: true,
      provider: "openrouter",
      model:
        process.env.OPENROUTER_VIDEO_MODEL || "bytedance-seed/seedance-2.0-mini",
      jobId,
      scene: sceneNumber,
      aspectRatio,
      scenePlan: detailedScene,
      video: {
        uri: videoUrl,
        url: videoUrl,
        available: true,
      },
      message: "Reel scene generated successfully with OpenRouter Video.",
    });
  } catch (error) {
    console.error("[Postoll] Generate reel error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate reel scene.",
      },
      { status: 500 }
    );
  }
}

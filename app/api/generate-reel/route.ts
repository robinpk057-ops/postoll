import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

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

type CharacterBibleItem = {
  [key: string]: unknown;
};

type ObjectBibleItem = {
  [key: string]: unknown;
};

type EnvironmentBible = {
  primaryEnvironment?: string;
  stableElements?: unknown[];
  variableElements?: unknown[];
  intentionalChanges?: unknown[];
  [key: string]: unknown;
};

type CinematographyBible = {
  [key: string]: unknown;
};

type AudioBible = {
  [key: string]: unknown;
};

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

  if (match) {
    return match;
  }

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

  return (
    scenes.find(
      (scene) => Number(scene.scene) === sceneNumber - 1
    ) ?? null
  );
}

function findNextScene(
  plan: GenerateReelRequest["plan"],
  sceneNumber: number
): DetailedScene | null {
  const scenes = plan.reelProduction?.scenes ?? [];

  return (
    scenes.find(
      (scene) => Number(scene.scene) === sceneNumber + 1
    ) ?? null
  );
}

function buildScenePrompt(
  plan: GenerateReelRequest["plan"],
  scene: DetailedScene,
  previousScene: DetailedScene | null,
  nextScene: DetailedScene | null,
  reelDuration: "15" | "30"
): string {
  const production = plan.reelProduction;
  const visual = plan.visualStrategy;

  const sceneNumber = Number(scene.scene ?? 1);

  return `
POSTOLL — PROFESSIONAL AI VIDEO PRODUCTION PROMPT

Generate ONE cinematic video generation unit belonging to a larger
${reelDuration}-second vertical social-media film.

This is NOT an isolated random clip.

The scene must visually belong to the same finished film.

==================================================
CORE RULE
==================================================

Generate exactly what is described.

Do not invent unrelated characters.
Do not invent unrelated locations.
Do not randomly change character identity.
Do not randomly change clothing.
Do not randomly change important props.
Do not randomly change weather.
Do not randomly change time of day.
Do not introduce extra people unless explicitly required.
Do not create duplicated people.
Do not create distorted anatomy.
Do not create unexplained objects.
Do not create unexplained camera movements.

The beginning of this clip must match the START STATE.

The ending of this clip must match the END STATE.

The next scene will begin from this ending state.

==================================================
FORMAT
==================================================

Vertical social-media video.

Aspect ratio: 9:16.

Target generation duration: approximately 8 seconds.

Cinematic professional production.

Natural physical movement.
Natural human movement.
Natural facial expressions.
Natural eye movement.
Natural body mechanics.
Natural interaction with objects.
Realistic lighting.
Realistic shadows.
Realistic depth.
Professional camera movement.

No subtitles.
No captions.
No UI.
No watermark.
No logo unless explicitly requested.
No random text.

==================================================
ORIGINAL USER REQUEST
==================================================

${plan.originalRequest ?? ""}

==================================================
TITLE
==================================================

${plan.title ?? ""}

==================================================
MASTER CONCEPT
==================================================

${plan.concept ?? ""}

==================================================
CREATIVE INTENT
==================================================

${plan.creativeIntent ?? ""}

==================================================
MASTER STORY
==================================================

Hook:
${production?.hook ?? ""}

Story premise:
${production?.storyPremise ?? ""}

Emotional progression:
${production?.emotionalProgression ?? ""}

Beginning:
${production?.beginning ?? ""}

Middle:
${production?.middle ?? ""}

Ending:
${production?.ending ?? ""}

Final payoff:
${production?.finalPayoff ?? ""}

Generation strategy:
${production?.generationStrategy ?? ""}

==================================================
CHARACTER CONTINUITY BIBLE
==================================================

${prettyJson(production?.characterBible ?? [])}

Preserve character identity across scenes:

- face
- age
- body proportions
- hairstyle
- skin appearance
- clothing
- accessories
- personality
- movement characteristics

Do not make the same character randomly become another person.

==================================================
ENVIRONMENT CONTINUITY BIBLE
==================================================

${prettyJson(production?.environmentBible ?? {})}

Preserve:

- terrain
- architecture
- vegetation
- major landmarks
- weather
- season
- time of day
- atmosphere
- visual color language

==================================================
OBJECT CONTINUITY BIBLE
==================================================

${prettyJson(production?.objectBible ?? [])}

Important objects must remain recognizable.

Preserve:

- appearance
- material
- color
- approximate size
- position logic
- movement logic

Objects must not teleport.

==================================================
CINEMATOGRAPHY BIBLE
==================================================

${prettyJson(production?.cinematographyBible ?? {})}

==================================================
AUDIO BIBLE
==================================================

${prettyJson(production?.audioBible ?? {})}

If dialogue exists, synchronize visible mouth movement naturally.

==================================================
CONTINUITY RULES
==================================================

${prettyJson(production?.continuityRules ?? {})}

==================================================
VISUAL STRATEGY
==================================================

${prettyJson(visual ?? {})}

==================================================
PREVIOUS SCENE
==================================================

${
  previousScene
    ? prettyJson(previousScene)
    : "This is the first scene. There is no previous scene."
}

==================================================
CURRENT SCENE
==================================================

Scene number:
${sceneNumber}

Scene purpose:
${scene.scenePurpose ?? ""}

Story beat:
${scene.storyBeat ?? ""}

Description:
${scene.description ?? ""}

Duration:
${scene.duration ?? "8 seconds"}

Generation unit:
${scene.generationUnit ?? sceneNumber}

Shot type:
${scene.shotType ?? ""}

Camera:
${scene.camera ?? ""}

Camera movement:
${scene.cameraMovement ?? ""}

Composition:
${scene.composition ?? ""}

Environment:
${scene.environment ?? ""}

Characters:
${prettyJson(scene.characters ?? [])}

Character action:
${scene.characterAction ?? ""}

Important objects:
${prettyJson(scene.importantObjects ?? [])}

Lighting:
${scene.lighting ?? ""}

Mood:
${scene.mood ?? ""}

Audio:
${scene.audio ?? ""}

Music moment:
${scene.musicMoment ?? ""}

Sound effects:
${prettyJson(scene.soundEffects ?? [])}

Dialogue:
${scene.dialogue ?? ""}

START STATE:
${scene.startState ?? ""}

END STATE:
${scene.endState ?? ""}

TRANSITION:
${scene.transition ?? ""}

VISUAL PRIORITY:
${scene.visualPriority ?? ""}

CONTINUITY FROM PREVIOUS:
${scene.continuityFromPrevious ?? ""}

CONTINUITY TO NEXT:
${scene.continuityToNext ?? ""}

==================================================
NEXT SCENE
==================================================

${
  nextScene
    ? prettyJson(nextScene)
    : "This is the final scene. Create a satisfying ending."
}

==================================================
PRODUCTION-READY GENERATION PROMPT
==================================================

${scene.generationPrompt ?? ""}

==================================================
NEGATIVE PROMPT
==================================================

${scene.negativePrompt ?? ""}

==================================================
CRITICAL START / END CONNECTION
==================================================

The first visible moments must represent:

${scene.startState ?? ""}

The final visible moments must represent:

${scene.endState ?? ""}

The ending must naturally prepare the following scene:

${scene.continuityToNext ?? nextScene?.startState ?? ""}

==================================================
HUMAN PERFORMANCE
==================================================

If people appear:

- preserve identity
- preserve approximate age
- preserve clothing
- preserve physical characteristics
- believable body mechanics
- believable facial expressions
- believable eye direction
- natural hand movement
- natural running/walking
- physically correct interaction with objects

If dialogue exists:

- natural mouth movement
- natural lip synchronization
- believable facial expression
- no exaggerated mouth deformation
- no accidental extra speech

==================================================
PHYSICAL REALISM
==================================================

Maintain:

- correct gravity
- correct object physics
- believable momentum
- believable contact with ground
- believable football movement
- realistic shadows
- realistic reflections
- realistic cloth movement
- realistic hair movement

==================================================
CAMERA
==================================================

The camera must feel intentionally operated by a professional cinematographer.

Do not use random zooms.

Do not use impossible camera movement.

Do not abruptly change focal language.

Do not create accidental camera shake.

Camera movement must support the story beat.

==================================================
FINAL REQUIREMENT
==================================================

The viewer must feel that this is one continuous professionally
directed film rather than an unrelated AI-generated clip.

Generate the scene only.
`;
}

async function createVideoJob(
  apiKey: string,
  prompt: string
): Promise<string> {
  /*
   * OpenRouter Video API.
   *
   * We deliberately use a specific video model instead of
   * openrouter/free because video generation models are handled
   * separately from the free text router.
   *
   * Seedance 2.0 Mini supports text-to-video and 4-15 second
   * generations according to OpenRouter's current video catalog.
   */

  const model =
    process.env.OPENROUTER_VIDEO_MODEL ||
    "bytedance-seed/seedance-2.0-mini";

  console.log("[Postoll] ========================================");
  console.log("[Postoll] OPENROUTER VIDEO GENERATION");
  console.log("[Postoll] Model:", model);
  console.log("[Postoll] Prompt length:", prompt.length);
  console.log("[Postoll] ========================================");

  const response = await fetch(
    "https://openrouter.ai/api/v1/videos",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3001",
        "X-Title": "Postoll",
      },
      body: JSON.stringify({
        model,
        prompt,
        duration: 8,
        aspect_ratio: "9:16",
      }),
    }
  );

  const rawText = await response.text();

  let data: JsonObject = {};

  try {
    data = JSON.parse(rawText) as JsonObject;
  } catch {
    throw new Error(
      `OpenRouter returned invalid JSON. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    console.error(
      "[Postoll] OpenRouter video request failed:",
      data
    );

    const errorObject =
      typeof data.error === "object" &&
      data.error !== null
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
    console.error(
      "[Postoll] OpenRouter video response:",
      data
    );

    throw new Error(
      "OpenRouter accepted the request but did not return a video job ID."
    );
  }

  console.log(
    "[Postoll] OpenRouter video job created:",
    jobId
  );

  return jobId;
}

async function waitForVideoJob(
  apiKey: string,
  jobId: string
): Promise<JsonObject> {
  const maxAttempts = 90;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[Postoll] Waiting for video... attempt ${attempt}/${maxAttempts}`
    );

    const response = await fetch(
      `https://openrouter.ai/api/v1/videos/${encodeURIComponent(
        jobId
      )}`,
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
      console.error(
        "[Postoll] OpenRouter video status error:",
        data
      );

      throw new Error(
        `OpenRouter video status request failed with HTTP ${response.status}.`
      );
    }

    const status =
      typeof data.status === "string"
        ? data.status.toLowerCase()
        : "";

    console.log(
      "[Postoll] Video status:",
      status || "unknown"
    );

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
        typeof data.error === "object" &&
        data.error !== null
          ? (data.error as Record<string, unknown>)
          : null;

      const message =
        typeof errorObject?.message === "string"
          ? errorObject.message
          : "OpenRouter video generation failed.";

      throw new Error(message);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 10000)
    );
  }

  throw new Error(
    "Video generation timed out. Please try again."
  );
}

function extractVideoUrl(
  result: JsonObject
): string | null {
  /*
   * OpenRouter's video response can evolve as providers are added.
   * We intentionally inspect several common locations instead of
   * assuming one fragile response shape.
   */

  const directCandidates: unknown[] = [
    result.video_url,
    result.url,
    result.download_url,
    result.output,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  const video =
    typeof result.video === "object" &&
    result.video !== null
      ? (result.video as Record<string, unknown>)
      : null;

  if (video) {
    const candidates: unknown[] = [
      video.url,
      video.video_url,
      video.download_url,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        return candidate;
      }
    }
  }

  const output =
    Array.isArray(result.output)
      ? result.output
      : null;

  if (output) {
    for (const item of output) {
      if (typeof item === "string") {
        return item;
      }

      if (
        typeof item === "object" &&
        item !== null
      ) {
        const objectItem =
          item as Record<string, unknown>;

        const candidates: unknown[] = [
          objectItem.url,
          objectItem.video_url,
          objectItem.download_url,
        ];

        for (const candidate of candidates) {
          if (typeof candidate === "string") {
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as GenerateReelRequest;

    if (!body.plan) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A creative plan is required.",
        },
        { status: 400 }
      );
    }

    if (!body.scene) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A reel scene is required.",
        },
        { status: 400 }
      );
    }

    const reelDuration =
      body.reelDuration === "30"
        ? "30"
        : "15";

    const sceneNumber =
      Number(body.scene.scene);

    if (!Number.isFinite(sceneNumber)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid reel scene number.",
        },
        { status: 400 }
      );
    }

    const detailedScene =
      findDetailedScene(
        body.plan,
        body.scene
      );

    const previousScene =
      findPreviousScene(
        body.plan,
        sceneNumber
      );

    const nextScene =
      findNextScene(
        body.plan,
        sceneNumber
      );

    const prompt =
      buildScenePrompt(
        body.plan,
        detailedScene,
        previousScene,
        nextScene,
        reelDuration
      );

    const apiKey =
      getOpenRouterApiKey();

    console.log(
      `[Postoll] Starting OpenRouter video generation for scene ${sceneNumber}`
    );

    console.log(
      `[Postoll] Detailed scene found: ${
        detailedScene.generationPrompt
          ? "YES"
          : "NO"
      }`
    );

    console.log(
      `[Postoll] Previous scene continuity: ${
        previousScene
          ? "YES"
          : "FIRST SCENE"
      }`
    );

    console.log(
      `[Postoll] Next scene continuity: ${
        nextScene
          ? "YES"
          : "FINAL SCENE"
      }`
    );

    /*
     * STEP 1
     * Create asynchronous video job.
     */

    const jobId =
      await createVideoJob(
        apiKey,
        prompt
      );

    /*
     * STEP 2
     * Wait for the generated video.
     */

    const result =
      await waitForVideoJob(
        apiKey,
        jobId
      );

    /*
     * STEP 3
     * Find the generated video URL.
     */

    const videoUrl =
      extractVideoUrl(result);

    if (!videoUrl) {
      console.error(
        "[Postoll] OpenRouter completed but no video URL was found:",
        result
      );

      throw new Error(
        "Video generation completed, but OpenRouter did not return a playable video URL."
      );
    }

    console.log(
      `[Postoll] Scene ${sceneNumber} video ready`
    );

    return NextResponse.json({
      success: true,

      provider: "openrouter",

      model:
        process.env.OPENROUTER_VIDEO_MODEL ||
        "bytedance-seed/seedance-2.0-mini",

      jobId,

      scene: sceneNumber,

      scenePlan: detailedScene,

      video: {
        uri: videoUrl,
        url: videoUrl,
        available: true,
      },

      continuity: {
        hasPrevious:
          Boolean(previousScene),

        hasNext:
          Boolean(nextScene),

        previousScene:
          previousScene?.scene ??
          null,

        nextScene:
          nextScene?.scene ??
          null,
      },

      message:
        "Reel scene generated successfully with OpenRouter Video.",
    });
  } catch (error) {
    console.error(
      "[Postoll] Generate reel error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate reel scene.",
      },
      {
        status: 500,
      }
    );
  }
}
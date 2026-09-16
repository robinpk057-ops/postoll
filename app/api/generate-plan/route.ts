import { NextRequest, NextResponse } from "next/server";

type ContentType = "post" | "reel";
type ReelDuration = "15" | "30" | null;

type GeneratePlanRequest = {
  idea?: string;
  type?: ContentType;
  contentTypes?: ContentType[];
  reelDuration?: ReelDuration;
};

type OpenRouterContentPart = {
  type?: string;
  text?: string;
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | OpenRouterContentPart[] | null;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
};

type ReelScene = {
  scene: number;
  scenePurpose: string;
  storyBeat: string;
  description: string;
  duration: string;
  generationUnit: number;
  shotType: string;
  camera: string;
  cameraMovement: string;
  composition: string;
  environment: string;
  characters: any[];
  characterAction: string;
  importantObjects: any[];
  lighting: string;
  mood: string;
  audio: string;
  musicMoment: string;
  soundEffects: string[];
  dialogue: string;
  voiceover: string;
  continuityFromPrevious: string;
  continuityToNext: string;
  startState: string;
  endState: string;
  transition: string;
  visualPriority: string;
  generationPrompt: string;
  negativePrompt: string;
};

type ReelProduction = {
  required: boolean;
  duration: ReelDuration;
  targetGenerationResolution: string;
  generationUnitDuration: string;
  generationStrategy: string;

  script: Record<string, any>;

  hook: string;
  storyPremise: string;
  emotionalProgression: string;
  beginning: string;
  middle: string;
  ending: string;
  finalPayoff: string;

  characterBible: any[];

  environmentBible: {
    primaryEnvironment: string;
    stableElements: string[];
    variableElements: string[];
    intentionalChanges: string[];
  };

  objectBible: any[];

  cinematographyBible: {
    visualStyle: string;
    realism: string;
    lensCharacter: string;
    cameraLanguage: string;
    cameraMovement: string;
    shotLanguage: string;
    depthOfField: string;
    lightingLanguage: string;
    colorGrade: string;
    motionLanguage: string;
  };

  audioBible: {
    musicStyle: string;
    instrumentation: string;
    tempo: string;
    emotionalTone: string;
    ambientSound: string;
    soundEffects: string[];
    dialogueStyle: string;
    musicProgression: string;
    audioContinuity: string;
  };

  continuityRules: {
    character: string[];
    environment: string[];
    objects: string[];
    lighting: string[];
    time: string[];
    camera: string[];
    action: string[];
    emotion: string[];
    audio: string[];
    color: string[];
    allowedChanges: string[];
  };

  referenceAssets: any[];
  scenes: ReelScene[];
};

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/* =========================================================
   BASIC HELPERS
========================================================= */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured. Add it to .env.local."
    );
  }

  return apiKey;
}

function asObject(value: unknown): Record<string, any> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, any>;
  }

  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/* =========================================================
   CONTENT TYPES
========================================================= */

function normalizeContentTypes(
  body: GeneratePlanRequest
): ContentType[] {
  if (
    Array.isArray(body.contentTypes) &&
    body.contentTypes.length > 0
  ) {
    const valid = body.contentTypes.filter(
      (type): type is ContentType =>
        type === "post" || type === "reel"
    );

    return Array.from(new Set(valid));
  }

  if (body.type === "reel") {
    return ["reel"];
  }

  return ["post"];
}

function getReelDuration(
  body: GeneratePlanRequest,
  contentTypes: ContentType[]
): ReelDuration {
  if (!contentTypes.includes("reel")) {
    return null;
  }

  return body.reelDuration === "30" ? "30" : "15";
}

function getGenerationUnits(
  duration: ReelDuration
): number {
  return duration === "30" ? 4 : 2;
}

/* =========================================================
   OPENROUTER RESPONSE
========================================================= */

function getMessageText(
  data: OpenRouterResponse
): string {
  const content =
    data.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  return "";
}

/* =========================================================
   JSON CLEANING
========================================================= */

function cleanJsonText(text: string): string {
  let cleaned = text.trim();

  cleaned = cleaned
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function parseJsonResponse(
  text: string,
  stageName: string
): Record<string, any> {
  const cleaned = cleanJsonText(text);

  try {
    return JSON.parse(cleaned) as Record<string, any>;
  } catch (error) {
    console.error(
      `[Postoll] ${stageName} JSON parse error:`,
      error
    );

    console.error(
      `[Postoll] ${stageName} response preview:`,
      cleaned.slice(0, 3000)
    );

    throw new Error(
      `${stageName} returned invalid JSON.`
    );
  }
}

/* =========================================================
   OPENROUTER CALL

   We use:
   openrouter/free

   OpenRouter chooses an available free model.

   No Gemini is used here.
========================================================= */

async function callOpenRouter(
  apiKey: string,
  stageName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{
  rawText: string;
  model: string;
}> {
  let lastError = "";

  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    console.log(
      `[Postoll] ${stageName} -> openrouter/free attempt ${attempt}`
    );

    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 90000);

      const response = await fetch(
        OPENROUTER_URL,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              "http://localhost:3000",
            "X-Title": "Postoll",
          },

          body: JSON.stringify({
            model: "openrouter/free",

            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],

            temperature: 0.25,

            max_tokens:
              stageName === "STAGE 1"
                ? 7000
                : 10000,

            response_format: {
              type: "json_object",
            },
          }),

          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      const responseText =
        await response.text();

      if (!response.ok) {
        lastError =
          `${stageName} -> HTTP ${response.status}: ` +
          responseText.slice(0, 2000);

        console.warn(
          `[Postoll] ${lastError}`
        );

        if (
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          await sleep(2000 * attempt);
          continue;
        }

        throw new Error(lastError);
      }

      let data: OpenRouterResponse;

      try {
        data =
          JSON.parse(responseText) as OpenRouterResponse;
      } catch {
        lastError =
          `${stageName} returned invalid OpenRouter API JSON.`;

        await sleep(1500 * attempt);
        continue;
      }

      if (data.error?.message) {
        lastError =
          `${stageName} OpenRouter error: ${data.error.message}`;

        await sleep(2000 * attempt);
        continue;
      }

      const finishReason =
        data.choices?.[0]?.finish_reason;

      const rawText =
        getMessageText(data);

      console.log(
        `[Postoll] ${stageName} response`,
        {
          model: data.model,
          finishReason,
          characters: rawText.length,
        }
      );

      if (!rawText) {
        lastError =
          `${stageName} returned no message content` +
          (
            finishReason
              ? ` (finish_reason: ${finishReason})`
              : ""
          );

        await sleep(2000 * attempt);
        continue;
      }

      const cleaned =
        cleanJsonText(rawText);

      try {
        JSON.parse(cleaned);
      } catch (error) {
        lastError =
          `${stageName} returned invalid JSON: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`;

        console.warn(
          `[Postoll] ${lastError}`
        );

        console.warn(
          `[Postoll] JSON preview:`,
          cleaned.slice(0, 2500)
        );

        await sleep(1500 * attempt);
        continue;
      }

      console.log(
        `[Postoll] ${stageName} successfully generated`
      );

      return {
        rawText: cleaned,
        model:
          data.model || "openrouter/free",
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        lastError =
          `${stageName} timed out after 90 seconds.`;
      }

      console.warn(
        `[Postoll] ${stageName} attempt ${attempt} failed:`,
        lastError
      );

      if (attempt < maxAttempts) {
        await sleep(2000 * attempt);
      }
    }
  }

  throw new Error(
    `${stageName} failed after ${maxAttempts} attempts. Last error: ${lastError}`
  );
}

/* =========================================================
   STAGE 1 SYSTEM PROMPT

   Stage 1 = actual creative script.

   Keep it relatively small so free models have a better
   chance of completing it.
========================================================= */

function buildStage1SystemPrompt(): string {
  return `
You are Postoll's senior creative director, advertising
strategist, professional screenwriter and commercial
film director.

Your job is to transform the user's simple idea into a
professional MASTER CREATIVE PLAN and REAL REEL SCRIPT.

You are NOT generating video prompts yet.

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.
Do not explain anything outside JSON.

For reels, create a genuine short-form cinematic story.

The story must contain:

- hook
- beginning
- middle
- ending
- final payoff
- emotional progression
- character action
- visual storytelling
- pacing

If there is no dialogue or narration, explicitly state that
the story is communicated through visual action, character
performance, music and environmental sound.

Characters must have stable visual identities.

Do not randomly change age, face, hairstyle, clothing,
body type or accessories.
`;
}

/* =========================================================
   STAGE 1 USER PROMPT
========================================================= */

function buildStage1UserPrompt(
  idea: string,
  contentTypes: ContentType[],
  reelDuration: ReelDuration
): string {
  const needsPost =
    contentTypes.includes("post");

  const needsReel =
    contentTypes.includes("reel");

  return `
USER IDEA
==================================================
${idea}
==================================================

CONTENT TYPES
==================================================
${contentTypes.join(", ")}

POST REQUIRED:
${needsPost ? "YES" : "NO"}

REEL REQUIRED:
${needsReel ? "YES" : "NO"}

REEL DURATION:
${reelDuration ?? "NOT APPLICABLE"}

==================================================
TASK
==================================================

Create the MASTER CREATIVE PLAN.

If a reel is requested, create a REAL cinematic script
that can later be converted into AI video scenes.

Do not create detailed video-generation prompts yet.

==================================================
REEL SCRIPT
==================================================

The reelMaster object MUST contain:

title
format
totalDuration
hook
voiceover
dialogue
fullNarration
beginning
middle
ending
finalPayoff
emotionalArc
pacing
scriptNotes
storyPremise
emotionalProgression
characterBible

fullNarration must NEVER be empty.

If there is no spoken narration use:

"No spoken narration. The story is communicated through
visual action, character performance, music and
environmental sound."

==================================================
CHARACTERS
==================================================

Important characters should contain:

characterId
name
age
gender
appearance
face
hair
build
clothing
footwear
accessories
personality
movementCharacteristics
stableIdentityTraits

==================================================
POST
==================================================

If a post is requested provide:

caption
hashtags
visualStrategy
textStrategy
brandingStrategy
imageDirection
avoid

==================================================
REQUIRED JSON
==================================================

{
  "originalRequest": "${idea.replace(/"/g, '\\"')}",
  "title": "",
  "concept": "",
  "creativeIntent": "",
  "caption": "",
  "hashtags": [],
  "visualStrategy": {
    "subjectType": "",
    "mainSubject": "",
    "secondarySubjects": [],
    "environment": "",
    "action": "",
    "mood": "",
    "visualStyle": "",
    "lighting": "",
    "composition": "",
    "camera": "",
    "colorDirection": ""
  },
  "textStrategy": {
    "textRequired": false,
    "reason": "",
    "requestedText": "",
    "placement": "",
    "style": ""
  },
  "brandingStrategy": {
    "brandMentioned": false,
    "brandName": "",
    "logoRequired": false
  },
  "imageDirection": "",
  "avoid": [],
  "reelMaster": {
    "required": ${needsReel},
    "duration": ${
      reelDuration
        ? `"${reelDuration}"`
        : "null"
    },
    "title": "",
    "format": "cinematic social media reel",
    "totalDuration": "",
    "hook": "",
    "voiceover": "",
    "dialogue": "",
    "fullNarration": "",
    "beginning": "",
    "middle": "",
    "ending": "",
    "finalPayoff": "",
    "emotionalArc": "",
    "pacing": "",
    "scriptNotes": "",
    "storyPremise": "",
    "emotionalProgression": "",
    "characterBible": []
  }
}

Return ONLY JSON.
`;
}

/* =========================================================
   STAGE 2 SYSTEM PROMPT

   Stage 2 converts the approved master script into
   production scenes.
========================================================= */

function buildStage2SystemPrompt(): string {
  return `
You are Postoll's senior cinematographer, AI video
production planner, continuity supervisor and commercial
film director.

You receive a MASTER REEL SCRIPT.

Convert it into a detailed production plan for AI video
generation.

The final reel must feel like ONE CONTINUOUS FILM.

Never randomly change:

- characters
- faces
- hairstyles
- clothing
- environment
- objects
- lighting
- time
- camera language
- visual style

Every scene must logically continue from the previous scene.

Return ONLY valid JSON.

No markdown.
No code fences.
No explanation outside JSON.
`;
}

/* =========================================================
   STAGE 2 USER PROMPT
========================================================= */

function buildStage2UserPrompt(
  idea: string,
  reelDuration: "15" | "30",
  master: Record<string, any>
): string {
  const generationUnits =
    getGenerationUnits(reelDuration);

  const masterScript =
    asObject(master.reelMaster);

  return `
ORIGINAL USER IDEA
==================================================
${idea}
==================================================

REEL DURATION
==================================================
${reelDuration} seconds

GENERATION UNITS
==================================================
${generationUnits}

Each generation unit represents approximately 8 seconds.

For a 15-second reel:
2 generation units.

For a 30-second reel:
4 generation units.

==================================================
MASTER REEL SCRIPT
==================================================

${JSON.stringify(
  masterScript,
  null,
  2
)}

==================================================
TASK
==================================================

Convert the master script into a complete AI video
production plan.

The reel must remain ONE CONTINUOUS FILM.

Create:

1. Character continuity bible
2. Environment continuity bible
3. Object continuity bible
4. Cinematography bible
5. Audio bible
6. Continuity rules
7. Reference assets
8. Detailed scenes

==================================================
SCENE COUNT
==================================================

Create EXACTLY ${generationUnits} scenes.

Each scene represents approximately one 8-second
generation unit.

The final editor may trim generated footage to reach
the requested final duration.

==================================================
EVERY SCENE MUST CONTAIN
==================================================

scene
scenePurpose
storyBeat
description
duration
generationUnit
shotType
camera
cameraMovement
composition
environment
characters
characterAction
importantObjects
lighting
mood
audio
musicMoment
soundEffects
dialogue
voiceover
continuityFromPrevious
continuityToNext
startState
endState
transition
visualPriority
generationPrompt
negativePrompt

==================================================
START STATE
==================================================

Describe exactly what is visible at the beginning.

==================================================
END STATE
==================================================

Describe exactly what is visible at the end.

The following scene must logically begin from the previous
scene's end state.

==================================================
GENERATION PROMPT
==================================================

The generationPrompt must include:

- subject
- exact character appearance
- clothing
- environment
- action
- camera
- lens
- framing
- camera movement
- lighting
- time
- atmosphere
- important objects
- visual style
- start state
- end state
- continuity requirements

Write a professional AI video-generation prompt.

==================================================
NEGATIVE PROMPT
==================================================

Include relevant restrictions.

At minimum consider:

no random characters
no duplicate people
no extra people
no extra limbs
no distorted faces
no face changes
no clothing changes
no hairstyle changes
no environment changes
no random objects
no text
no subtitles
no logo
no watermark
no broken physics
no unnatural movement
no unrelated background action

==================================================
REQUIRED JSON
==================================================

{
  "reelProduction": {
    "required": true,
    "duration": "${reelDuration}",
    "targetGenerationResolution": "4K",
    "generationUnitDuration": "8 seconds",
    "generationStrategy": "",
    "script": ${JSON.stringify(
      masterScript
    )},
    "hook": "",
    "storyPremise": "",
    "emotionalProgression": "",
    "beginning": "",
    "middle": "",
    "ending": "",
    "finalPayoff": "",
    "characterBible": [],
    "environmentBible": {
      "primaryEnvironment": "",
      "stableElements": [],
      "variableElements": [],
      "intentionalChanges": []
    },
    "objectBible": [],
    "cinematographyBible": {
      "visualStyle": "",
      "realism": "",
      "lensCharacter": "",
      "cameraLanguage": "",
      "cameraMovement": "",
      "shotLanguage": "",
      "depthOfField": "",
      "lightingLanguage": "",
      "colorGrade": "",
      "motionLanguage": ""
    },
    "audioBible": {
      "musicStyle": "",
      "instrumentation": "",
      "tempo": "",
      "emotionalTone": "",
      "ambientSound": "",
      "soundEffects": [],
      "dialogueStyle": "",
      "musicProgression": "",
      "audioContinuity": ""
    },
    "continuityRules": {
      "character": [],
      "environment": [],
      "objects": [],
      "lighting": [],
      "time": [],
      "camera": [],
      "action": [],
      "emotion": [],
      "audio": [],
      "color": [],
      "allowedChanges": []
    },
    "referenceAssets": [],
    "scenes": []
  }
}

==================================================
QUALITY CHECK
==================================================

Before returning JSON verify:

- Exactly ${generationUnits} scenes.
- Characters remain consistent.
- Clothing remains consistent.
- Environment remains consistent.
- Lighting remains logical.
- Scene 2 continues Scene 1.
- Every scene has generationPrompt.
- Every scene has negativePrompt.
- Every scene has startState.
- Every scene has endState.
- Every scene has continuity information.
- Generation units are numbered correctly.
- Camera continuity exists.
- Audio continuity exists.

Return ONLY JSON.
`;
}

/* =========================================================
   EMPTY VISUAL STRUCTURES
========================================================= */

function createEmptyVisualStrategy() {
  return {
    subjectType: "",
    mainSubject: "",
    secondarySubjects: [],
    environment: "",
    action: "",
    mood: "",
    visualStyle: "",
    lighting: "",
    composition: "",
    camera: "",
    colorDirection: "",
  };
}

function createEmptyTextStrategy() {
  return {
    textRequired: false,
    reason: "",
    requestedText: "",
    placement: "",
    style: "",
  };
}

function createEmptyBrandingStrategy() {
  return {
    brandMentioned: false,
    brandName: "",
    logoRequired: false,
  };
}

/* =========================================================
   EMPTY REEL PRODUCTION

   Explicit ReelProduction return type prevents the
   TypeScript errors from the previous version.
========================================================= */

function createEmptyReelProduction(
  duration: ReelDuration
): ReelProduction {
  return {
    required: Boolean(duration),

    duration,

    targetGenerationResolution: "4K",

    generationUnitDuration:
      "8 seconds",

    generationStrategy:
      "Sequential cinematic generation units with strict character, environment, camera, lighting and object continuity.",

    script: {
      title: "",
      format:
        "cinematic social media reel",
      totalDuration: duration
        ? `${duration} seconds`
        : "",
      hook: "",
      voiceover: "",
      dialogue: "",
      fullNarration: "",
      beginning: "",
      middle: "",
      ending: "",
      finalPayoff: "",
      emotionalArc: "",
      pacing: "",
      scriptNotes: "",
    },

    hook: "",
    storyPremise: "",
    emotionalProgression: "",
    beginning: "",
    middle: "",
    ending: "",
    finalPayoff: "",

    characterBible: [],

    environmentBible: {
      primaryEnvironment: "",
      stableElements: [],
      variableElements: [],
      intentionalChanges: [],
    },

    objectBible: [],

    cinematographyBible: {
      visualStyle: "",
      realism: "",
      lensCharacter: "",
      cameraLanguage: "",
      cameraMovement: "",
      shotLanguage: "",
      depthOfField: "",
      lightingLanguage: "",
      colorGrade: "",
      motionLanguage: "",
    },

    audioBible: {
      musicStyle: "",
      instrumentation: "",
      tempo: "",
      emotionalTone: "",
      ambientSound: "",
      soundEffects: [],
      dialogueStyle: "",
      musicProgression: "",
      audioContinuity: "",
    },

    continuityRules: {
      character: [],
      environment: [],
      objects: [],
      lighting: [],
      time: [],
      camera: [],
      action: [],
      emotion: [],
      audio: [],
      color: [],
      allowedChanges: [],
    },

    referenceAssets: [],

    scenes: [],
  };
}

/* =========================================================
   STAGE 1 REPAIR
========================================================= */

function repairMasterScript(
  master: Record<string, any>,
  idea: string,
  duration: ReelDuration
): Record<string, any> {
  const reel =
    asObject(master.reelMaster);

  master.originalRequest =
    asString(master.originalRequest) ||
    idea;

  master.title =
    asString(master.title) ||
    "Postoll Creative Plan";

  master.concept =
    asString(master.concept) ||
    idea;

  master.creativeIntent =
    asString(master.creativeIntent) ||
    "Create an engaging professional social-media creative.";

  if (!Array.isArray(master.hashtags)) {
    master.hashtags = [];
  }

  if (!Array.isArray(master.avoid)) {
    master.avoid = [];
  }

  if (
    !master.visualStrategy ||
    typeof master.visualStrategy !== "object"
  ) {
    master.visualStrategy =
      createEmptyVisualStrategy();
  }

  if (
    !master.textStrategy ||
    typeof master.textStrategy !== "object"
  ) {
    master.textStrategy =
      createEmptyTextStrategy();
  }

  if (
    !master.brandingStrategy ||
    typeof master.brandingStrategy !== "object"
  ) {
    master.brandingStrategy =
      createEmptyBrandingStrategy();
  }

  master.imageDirection =
    asString(master.imageDirection) ||
    "Create a polished professional social-media visual based directly on the user's idea.";

  if (duration) {
    reel.title =
      asString(reel.title) ||
      asString(master.title) ||
      "Cinematic Reel";

    reel.format =
      asString(reel.format) ||
      "cinematic social media reel";

    reel.totalDuration =
      asString(reel.totalDuration) ||
      `${duration} seconds`;

    reel.fullNarration =
      asString(reel.fullNarration) ||
      "No spoken narration. The story is communicated through visual action, character performance, music and environmental sound.";

    reel.voiceover =
      asString(reel.voiceover) ||
      "No voiceover. Visual storytelling carries the narrative.";

    reel.dialogue =
      asString(reel.dialogue) ||
      "No spoken dialogue.";

    reel.hook =
      asString(reel.hook) ||
      "Open immediately with the strongest visual moment.";

    reel.beginning =
      asString(reel.beginning) ||
      "Establish the characters, location and central action.";

    reel.middle =
      asString(reel.middle) ||
      "Develop the action and build visual momentum.";

    reel.ending =
      asString(reel.ending) ||
      "Resolve the central action with a memorable cinematic moment.";

    reel.finalPayoff =
      asString(reel.finalPayoff) ||
      "End on the strongest memorable visual beat.";

    reel.emotionalArc =
      asString(reel.emotionalArc) ||
      "Build from immediate visual interest toward an emotionally satisfying payoff.";

    reel.pacing =
      asString(reel.pacing) ||
      "Immediate hook, escalating action, controlled progression and strong final payoff.";

    reel.scriptNotes =
      asString(reel.scriptNotes) ||
      "Maintain exact character, environment, lighting, camera and object continuity.";

    if (!Array.isArray(reel.characterBible)) {
      reel.characterBible = [];
    }

    master.reelMaster = reel;
  }

  return master;
}

/* =========================================================
   STAGE 2 REPAIR
========================================================= */

function repairReelProduction(
  stage2: Record<string, any>,
  master: Record<string, any>,
  duration: "15" | "30"
): ReelProduction {
  const defaults =
    createEmptyReelProduction(duration);

  const received =
    asObject(stage2.reelProduction);

  const reel: ReelProduction = {
    ...defaults,
    ...received,
  } as ReelProduction;

  const masterScript =
    asObject(master.reelMaster);

  reel.required = true;
  reel.duration = duration;

  reel.targetGenerationResolution =
    "4K";

  reel.generationUnitDuration =
    "8 seconds";

  reel.generationStrategy =
    asString(reel.generationStrategy) ||
    defaults.generationStrategy;

  reel.script = {
    ...defaults.script,
    ...masterScript,
    ...asObject(reel.script),
  };

  reel.hook =
    asString(reel.hook) ||
    asString(masterScript.hook);

  reel.storyPremise =
    asString(reel.storyPremise) ||
    asString(masterScript.storyPremise);

  reel.emotionalProgression =
    asString(reel.emotionalProgression) ||
    asString(
      masterScript.emotionalProgression
    );

  reel.beginning =
    asString(reel.beginning) ||
    asString(masterScript.beginning);

  reel.middle =
    asString(reel.middle) ||
    asString(masterScript.middle);

  reel.ending =
    asString(reel.ending) ||
    asString(masterScript.ending);

  reel.finalPayoff =
    asString(reel.finalPayoff) ||
    asString(masterScript.finalPayoff);

  if (!Array.isArray(reel.characterBible)) {
    reel.characterBible = [];
  }

  if (!Array.isArray(reel.objectBible)) {
    reel.objectBible = [];
  }

  if (!Array.isArray(reel.referenceAssets)) {
    reel.referenceAssets = [];
  }

  if (!Array.isArray(reel.scenes)) {
    reel.scenes = [];
  }

  reel.environmentBible = {
    ...defaults.environmentBible,
    ...asObject(reel.environmentBible),
  };

  reel.cinematographyBible = {
    ...defaults.cinematographyBible,
    ...asObject(reel.cinematographyBible),
  };

  reel.audioBible = {
    ...defaults.audioBible,
    ...asObject(reel.audioBible),
  };

  reel.continuityRules = {
    ...defaults.continuityRules,
    ...asObject(reel.continuityRules),
  };

  reel.script.fullNarration =
    asString(reel.script.fullNarration) ||
    asString(masterScript.fullNarration) ||
    "No spoken narration. The story is communicated through visual action, character performance, music and environmental sound.";

  return reel;
}

/* =========================================================
   SCENE REPAIR

   Returns exactly the number of scenes needed.
========================================================= */

function repairScenes(
  scenes: any[],
  generationUnits: number
): ReelScene[] {
  const repaired: ReelScene[] = [];

  for (
    let index = 0;
    index < generationUnits;
    index++
  ) {
    const item =
      asObject(scenes[index]);

    const scene: ReelScene = {
      ...item,

      scene:
        typeof item.scene === "number"
          ? item.scene
          : index + 1,

      scenePurpose:
        asString(item.scenePurpose) ||
        `Continue the reel story in generation unit ${
          index + 1
        }.`,

      storyBeat:
        asString(item.storyBeat) ||
        `Story beat ${index + 1}.`,

      description:
        asString(item.description) ||
        "Cinematic continuation of the established story.",

      duration:
        asString(item.duration) ||
        "8 seconds",

      generationUnit:
        typeof item.generationUnit === "number"
          ? item.generationUnit
          : index + 1,

      shotType:
        asString(item.shotType) ||
        "cinematic medium-wide shot",

      camera:
        asString(item.camera) ||
        "cinematic digital cinema camera",

      cameraMovement:
        asString(item.cameraMovement) ||
        "smooth controlled cinematic movement",

      composition:
        asString(item.composition) ||
        "subject-focused cinematic composition",

      environment:
        asString(item.environment) ||
        "consistent established story environment",

      characters:
        Array.isArray(item.characters)
          ? item.characters
          : [],

      characterAction:
        asString(item.characterAction) ||
        "Continue the established action naturally.",

      importantObjects:
        Array.isArray(item.importantObjects)
          ? item.importantObjects
          : [],

      lighting:
        asString(item.lighting) ||
        "Maintain established cinematic lighting.",

      mood:
        asString(item.mood) ||
        "cinematic and emotionally engaging",

      audio:
        asString(item.audio) ||
        "Natural environmental sound with continuous music.",

      musicMoment:
        asString(item.musicMoment) ||
        "Continue the established music.",

      soundEffects:
        Array.isArray(item.soundEffects)
          ? item.soundEffects
          : [],

      dialogue:
        asString(item.dialogue),

      voiceover:
        asString(item.voiceover),

      continuityFromPrevious:
        asString(item.continuityFromPrevious) ||
        (
          index === 0
            ? "Opening state establishes the film."
            : "Continue directly from the previous scene's end state."
        ),

      continuityToNext:
        asString(item.continuityToNext) ||
        (
          index === generationUnits - 1
            ? "End on the final payoff state."
            : "End in a state that can continue naturally into the next generation unit."
        ),

      startState:
        asString(item.startState) ||
        "Begin from the established visual continuity.",

      endState:
        asString(item.endState) ||
        "End in a visually clear state that can connect to the next generation unit.",

      transition:
        asString(item.transition) ||
        "Natural cinematic continuation.",

      visualPriority:
        asString(item.visualPriority) ||
        "Character action and story clarity.",

      generationPrompt:
        asString(item.generationPrompt) ||
        "Generate a cinematic continuation of the established story while preserving exact character identity, clothing, environment, lighting, camera language and object continuity.",

      negativePrompt:
        asString(item.negativePrompt) ||
        "No random characters, no duplicate people, no extra people, no extra limbs, no distorted faces, no face changes, no clothing changes, no hairstyle changes, no environment changes, no random objects, no text, no subtitles, no logo, no watermark, no broken physics, no unnatural movement.",
    };

    repaired.push(scene);
  }

  return repaired;
}

/* =========================================================
   VALIDATION
========================================================= */

function validateStage1(
  master: Record<string, any>,
  needsReel: boolean
) {
  if (!needsReel) {
    return;
  }

  const reel =
    asObject(master.reelMaster);

  const requiredFields = [
    "title",
    "hook",
    "beginning",
    "middle",
    "ending",
    "finalPayoff",
    "fullNarration",
  ];

  for (const field of requiredFields) {
    if (!asString(reel[field])) {
      throw new Error(
        `Stage 1 returned an incomplete reel script: ${field}`
      );
    }
  }
}

function validateStage2(
  reel: ReelProduction,
  generationUnits: number
) {
  const scenes =
    Array.isArray(reel.scenes)
      ? reel.scenes
      : [];

  if (scenes.length !== generationUnits) {
    throw new Error(
      `Stage 2 returned ${scenes.length} scenes, but ${generationUnits} generation units are required.`
    );
  }

  for (
    let index = 0;
    index < generationUnits;
    index++
  ) {
    const scene = scenes[index];

    const requiredFields = [
      "description",
      "startState",
      "endState",
      "generationPrompt",
      "negativePrompt",
      "continuityFromPrevious",
      "continuityToNext",
    ];

    for (const field of requiredFields) {
      if (!asString(scene[field as keyof ReelScene])) {
        throw new Error(
          `Stage 2 scene ${
            index + 1
          } is missing ${field}.`
        );
      }
    }
  }
}

/* =========================================================
   TOP LEVEL SCENES

   Keeps compatibility with the existing frontend.
========================================================= */

function createTopLevelScenes(
  reel: ReelProduction
) {
  return reel.scenes.map(
    (scene, index) => ({
      scene:
        typeof scene.scene === "number"
          ? scene.scene
          : index + 1,

      description:
        asString(scene.description),

      duration:
        asString(scene.duration) ||
        "8 seconds",

      generationUnit:
        typeof scene.generationUnit === "number"
          ? scene.generationUnit
          : index + 1,
    })
  );
}

/* =========================================================
   MAIN POST HANDLER
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as GeneratePlanRequest;

    const idea =
      body.idea?.trim();

    if (!idea) {
      return NextResponse.json(
        {
          error:
            "Please provide an idea.",
        },
        {
          status: 400,
        }
      );
    }

    const contentTypes =
      normalizeContentTypes(body);

    if (contentTypes.length === 0) {
      return NextResponse.json(
        {
          error:
            "Choose at least one content type.",
        },
        {
          status: 400,
        }
      );
    }

    const reelDuration =
      getReelDuration(
        body,
        contentTypes
      );

    const needsReel =
      contentTypes.includes("reel");

    const needsPost =
      contentTypes.includes("post");

    console.log(
      "[Postoll] ========================================"
    );

    console.log(
      "[Postoll] STARTING 2-STAGE CREATIVE PIPELINE"
    );

    console.log(
      "[Postoll] Request:",
      {
        idea,
        contentTypes,
        reelDuration,
      }
    );

    console.log(
      "[Postoll] AI PROVIDER: OpenRouter"
    );

    console.log(
      "[Postoll] MODEL ROUTER: openrouter/free"
    );

    const apiKey =
      getOpenRouterApiKey();

    /* =====================================================
       STAGE 1

       Master creative plan + actual reel script.
    ===================================================== */

    console.log(
      "[Postoll] STAGE 1/2 -> Creating master creative plan + reel script"
    );

    const stage1 =
      await callOpenRouter(
        apiKey,
        "STAGE 1",
        buildStage1SystemPrompt(),
        buildStage1UserPrompt(
          idea,
          contentTypes,
          reelDuration
        )
      );

    let masterPlan =
      parseJsonResponse(
        stage1.rawText,
        "STAGE 1"
      );

    masterPlan =
      repairMasterScript(
        masterPlan,
        idea,
        reelDuration
      );

    validateStage1(
      masterPlan,
      needsReel
    );

    const masterReel =
      asObject(
        masterPlan.reelMaster
      );

    console.log(
      "[Postoll] STAGE 1 COMPLETE",
      {
        model: stage1.model,
        title:
          asString(masterPlan.title),
        hasReelScript:
          Boolean(
            asString(masterReel.title)
          ),
        fullNarrationLength:
          asString(
            masterReel.fullNarration
          ).length,
      }
    );

    /* =====================================================
       STAGE 2

       Detailed cinematic production plan.
    ===================================================== */

    let finalReelProduction: ReelProduction =
      createEmptyReelProduction(
        reelDuration
      );

    if (
      needsReel &&
      reelDuration
    ) {
      console.log(
        "[Postoll] STAGE 2/2 -> Creating detailed reel production plan"
      );

      const stage2 =
        await callOpenRouter(
          apiKey,
          "STAGE 2",
          buildStage2SystemPrompt(),
          buildStage2UserPrompt(
            idea,
            reelDuration,
            masterPlan
          )
        );

      const stage2Plan =
        parseJsonResponse(
          stage2.rawText,
          "STAGE 2"
        );

      finalReelProduction =
        repairReelProduction(
          stage2Plan,
          masterPlan,
          reelDuration
        );

      const generationUnits =
        getGenerationUnits(
          reelDuration
        );

      /*
       * IMPORTANT:
       *
       * This is the only place where scenes are repaired.
       *
       * There is NO `plan` variable here.
       * There is NO second declaration of
       * `finalReelProduction`.
       */

      finalReelProduction.scenes =
        repairScenes(
          finalReelProduction.scenes,
          generationUnits
        );

      validateStage2(
        finalReelProduction,
        generationUnits
      );

      console.log(
        "[Postoll] STAGE 2 COMPLETE",
        {
          model: stage2.model,
          scenes:
            finalReelProduction.scenes.length,
          generationUnits,
        }
      );
    }

    /* =====================================================
       FINAL PLAN

       Everything is assembled only AFTER both stages.
    ===================================================== */

    const plan: Record<string, any> = {
      originalRequest:
        idea,

      title:
        asString(masterPlan.title) ||
        "Postoll Creative Plan",

      concept:
        asString(masterPlan.concept) ||
        idea,

      creativeIntent:
        asString(
          masterPlan.creativeIntent
        ) ||
        "Create an engaging professional social-media creative.",

      caption:
        asString(masterPlan.caption),

      hashtags:
        Array.isArray(
          masterPlan.hashtags
        )
          ? masterPlan.hashtags
          : [],

      visualStrategy:
        masterPlan.visualStrategy ||
        createEmptyVisualStrategy(),

      textStrategy:
        masterPlan.textStrategy ||
        createEmptyTextStrategy(),

      brandingStrategy:
        masterPlan.brandingStrategy ||
        createEmptyBrandingStrategy(),

      imageDirection:
        asString(
          masterPlan.imageDirection
        ) ||
        "Create a polished professional social-media visual based directly on the user's idea.",

      avoid:
        Array.isArray(masterPlan.avoid)
          ? masterPlan.avoid
          : [],

      reelProduction:
        finalReelProduction,

      scenes:
        createTopLevelScenes(
          finalReelProduction
        ),
    };

    /* =====================================================
       NO REEL REQUESTED
    ===================================================== */

    if (!needsReel) {
      plan.reelProduction =
        createEmptyReelProduction(
          null
        );

      plan.scenes = [];
    }

    /* =====================================================
       FINAL LOGGING
    ===================================================== */

    console.log(
      "[Postoll] ========================================"
    );

    console.log(
      "[Postoll] CREATIVE PIPELINE COMPLETE"
    );

    console.log(
      "[Postoll] Final statistics:",
      {
        contentTypes,
        reelDuration,

        hasPost:
          needsPost,

        hasReel:
          needsReel,

        detailedReelScenes:
          plan.reelProduction.scenes.length,

        hasMasterScript:
          Boolean(
            asString(
              plan.reelProduction
                .script?.title
            )
          ),

        fullNarrationLength:
          asString(
            plan.reelProduction
              .script?.fullNarration
          ).length,
      }
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      plan,

      contentTypes,

      reelDuration,

      model:
        "openrouter/free",

      pipeline:
        needsReel
          ? "2-stage"
          : "1-stage",

      stages:
        needsReel
          ? {
              stage1:
                "master creative plan + real reel script",

              stage2:
                "detailed cinematic production scenes",
            }
          : {
              stage1:
                "master creative plan",
            },
    });
  } catch (error) {
    console.error(
      "[Postoll] ========================================"
    );

    console.error(
      "[Postoll] Generate plan error:",
      error
    );

    console.error(
      "[Postoll] ========================================"
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate content plan.",
      },
      {
        status: 500,
      }
    );
  }
}
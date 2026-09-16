import { NextResponse } from "next/server";
import OpenAI from "openai";

/*
|--------------------------------------------------------------------------
| OPENAI
|--------------------------------------------------------------------------
*/

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Do NOT put `logoFile: File` in this server-side request type.
|
| File objects belong to the browser/client.
| The API only receives serializable workflow information.
|
*/

type GenerateScriptRequest = {
  name?: string;

  source?: "ai_generated" | "user_uploaded" | "";

  contentDescription?: string;

  formats?: string[];

  styles?: string[];

  enablePost?: boolean;

  enableReel?: boolean;

  showLogo?: boolean;

  showPageName?: boolean;

  brandName?: string;

  textOverlay?: boolean;

  videoMode?: string;

  voiceOver?: boolean;

  voiceType?: string;

  voiceStyle?: string;

  characterEnabled?: boolean;

  characterType?: string;

  characterGender?: string;

  characterAge?: string;

  targetCountries?: string[];

  backgroundMusic?: boolean;

  language?: string;

  videoLanguage?: string;

  uploadDescription?: string;

  generateCaption?: boolean;

  generateHashtags?: boolean;

  generateDescription?: boolean;

  addSubtitles?: boolean;

  autoEdit?: boolean;
};

type GeneratedScripts = {
  reelScript: string;
  postScript: string;
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function cleanString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function cleanStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonResponse(
  text: string
): GeneratedScripts {
  /*
   * First try direct JSON.
   */

  try {
    const parsed = JSON.parse(text);

    return {
      reelScript:
        typeof parsed?.reelScript === "string"
          ? parsed.reelScript.trim()
          : "",

      postScript:
        typeof parsed?.postScript === "string"
          ? parsed.postScript.trim()
          : "",
    };
  } catch {
    /*
     * Continue below.
     */
  }

  /*
   * Sometimes models return JSON inside a markdown
   * code block. Remove the code fences and retry.
   */

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      reelScript:
        typeof parsed?.reelScript === "string"
          ? parsed.reelScript.trim()
          : "",

      postScript:
        typeof parsed?.postScript === "string"
          ? parsed.postScript.trim()
          : "",
    };
  } catch {
    /*
     * If the model returned plain text instead of JSON,
     * return it as the relevant script rather than
     * silently losing the generated content.
     */

    return {
      reelScript: cleaned,
      postScript: cleaned,
    };
  }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

export async function POST(
  request: Request
) {
  try {
    /*
    |--------------------------------------------------------------------------
    | CHECK API KEY
    |--------------------------------------------------------------------------
    */

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | READ REQUEST
    |--------------------------------------------------------------------------
    */

    const body =
      (await request.json()) as GenerateScriptRequest;

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE VALUES
    |--------------------------------------------------------------------------
    */

    const contentDescription =
      cleanString(
        body.contentDescription
      );

    const formats =
      cleanStringArray(body.formats);

    const styles =
      cleanStringArray(body.styles);

    const targetCountries =
      cleanStringArray(
        body.targetCountries
      );

    const language =
      cleanString(
        body.language
      ) || "English";

    const videoLanguage =
      cleanString(
        body.videoLanguage
      ) || language;

    const brandName =
      cleanString(
        body.brandName
      );

    const source =
      cleanString(body.source);

    /*
    |--------------------------------------------------------------------------
    | REQUIRED FIELD
    |--------------------------------------------------------------------------
    |
    | This is the actual mandatory field from the
    | Postoll content-creation page.
    |
    */

    if (!contentDescription) {
      return NextResponse.json(
        {
          error:
            "Please tell Postoll what content it should create.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CONTENT TYPES
    |--------------------------------------------------------------------------
    |
    | Content Type is mandatory on the UI, but the API
    | remains defensive and supports both the formats
    | array and enablePost / enableReel flags.
    |
    */

    const wantsReel =
      body.enableReel === true ||
      formats.some(
        (format) =>
          format.toLowerCase() ===
          "reel"
      );

    const wantsPost =
      body.enablePost === true ||
      formats.some(
        (format) =>
          format.toLowerCase() ===
          "post"
      );

    if (!wantsReel && !wantsPost) {
      return NextResponse.json(
        {
          error:
            "Please select at least one content type: Post or Reel.",
        },
        {
          status: 400,
        }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | BUILD CONTEXT
    |--------------------------------------------------------------------------
    |
    | Only serializable values are used here.
    |
    | NOTICE:
    |
    | There is intentionally NO:
    |
    | workflow.logoFile
    |
    | because a browser File cannot be used by this
    | server route unless it is explicitly uploaded.
    |
    */

    const context = [
      `Content request:
${contentDescription}`,

      `Source:
${source || "ai_generated"}`,

      `Content types:
${formats.length > 0
        ? formats.join(", ")
        : [
            wantsPost
              ? "Post"
              : "",
            wantsReel
              ? "Reel"
              : "",
          ]
            .filter(Boolean)
            .join(", ")}`,

      `Visual styles:
${styles.length > 0
        ? styles.join(", ")
        : "Not specified"}`,

      `Brand/page name:
${brandName || "Not specified"}`,

      `Logo enabled:
${body.showLogo === true
        ? "Yes"
        : "No"}`,

      `Brand/page name enabled:
${body.showPageName === true
        ? "Yes"
        : "No"}`,

      `Text overlay:
${body.textOverlay === true
        ? "Yes"
        : "No"}`,

      `Video mode:
${cleanString(body.videoMode) || "Not specified"}`,

      `Voice over:
${body.voiceOver === true
        ? "Yes"
        : "No"}`,

      `Voice type:
${cleanString(body.voiceType) || "Not specified"}`,

      `Voice style:
${cleanString(body.voiceStyle) || "Not specified"}`,

      `AI character:
${body.characterEnabled === true
        ? "Yes"
        : "No"}`,

      `Character type:
${cleanString(body.characterType) || "Not specified"}`,

      `Character gender:
${cleanString(body.characterGender) || "Not specified"}`,

      `Character age:
${cleanString(body.characterAge) || "Not specified"}`,

      `Target countries:
${targetCountries.length > 0
        ? targetCountries.join(", ")
        : "Not specified"}`,

      `Background music:
${body.backgroundMusic === true
        ? "Yes"
        : "No"}`,

      `Content language:
${language}`,

      `Video language:
${videoLanguage}`,

      `Uploaded-content description:
${cleanString(body.uploadDescription) || "Not applicable"}`,

      `Generate caption:
${body.generateCaption !== false
        ? "Yes"
        : "No"}`,

      `Generate hashtags:
${body.generateHashtags !== false
        ? "Yes"
        : "No"}`,

      `Generate description:
${body.generateDescription !== false
        ? "Yes"
        : "No"}`,

      `Add subtitles:
${body.addSubtitles === true
        ? "Yes"
        : "No"}`,

      `Auto edit video:
${body.autoEdit === true
        ? "Yes"
        : "No"}`,
    ].join("\n\n");

    /*
    |--------------------------------------------------------------------------
    | PROMPT
    |--------------------------------------------------------------------------
    */

    const prompt = `
You are Postoll's content strategy and script generation engine.

Your job is to create TWO independent content strategies:

1. Reel Script
2. Post Script

The user may request a Post, a Reel, or both.

IMPORTANT:
- If a content type was NOT selected, return an empty string for that script.
- Do NOT create a Reel Script when Reel was not selected.
- Do NOT create a Post Script when Post was not selected.
- Do not ask the user questions.
- Use reasonable defaults when optional fields are missing.
- The user's content description is the most important instruction.
- The scripts must be original and suitable for repeated social-media publishing.
- Avoid repetitive wording and generic filler.
- The content should feel like something a real brand would publish.

REEL REQUIREMENTS
- Create a complete short-form reel script.
- The reel should work as a roughly 30-second social video.
- Structure it as a sequence of scenes.
- Each scene should contain:
  Scene number
  Scene title
  Visual direction
  Dialogue/narration
  Approximate duration
- Aim for approximately 3 scenes of about 8–12 seconds each.
- Make the dialogue natural.
- If voice-over is disabled, make the visual/story structure still work without spoken narration.
- If AI character is enabled, make the character appropriate to the requested audience information.
- Do not claim that the logo itself has been received. Only note that logo placement is enabled.
- Do not invent an actual logo URL.

POST REQUIREMENTS
- Create a separate strategy for a visual/text-based social post.
- Include:
  Hook
  Main message
  Visual direction
  On-image text if appropriate
  Caption direction
  CTA
  Hashtag direction
- Keep the post distinct from the Reel.
- Do not simply convert the Reel Script into a caption.

BRANDING
If logo is enabled, plan for the logo to be placed in the final creative.
Do NOT attempt to access or generate a logo file.
The actual logo file will be handled separately by Postoll's upload/storage system.

If brand/page name is enabled and a brand name is provided, incorporate it naturally.

LANGUAGE
Write the generated content in:
${videoLanguage}

WORKFLOW DATA
${context}

Return ONLY valid JSON in this exact structure:

{
  "reelScript": "string",
  "postScript": "string"
}

If Reel was not selected:
"reelScript": ""

If Post was not selected:
"postScript": ""
`;

    /*
    |--------------------------------------------------------------------------
    | GENERATE
    |--------------------------------------------------------------------------
    */

    const response =
      await openai.responses.create({
        model:
          process.env.POSTOLL_SCRIPT_MODEL ||
          "gpt-5.6",

        input: prompt,

        temperature: 0.8,
      });

    /*
    |--------------------------------------------------------------------------
    | OUTPUT
    |--------------------------------------------------------------------------
    */

    const outputText =
      response.output_text?.trim();

    if (!outputText) {
      throw new Error(
        "Postoll did not receive a script from the AI model."
      );
    }

    const generated =
      parseJsonResponse(
        outputText
      );

    /*
    |--------------------------------------------------------------------------
    | NORMALIZE NON-SELECTED CONTENT
    |--------------------------------------------------------------------------
    */

    const result: GeneratedScripts = {
      reelScript: wantsReel
        ? generated.reelScript
        : "",

      postScript: wantsPost
        ? generated.postScript
        : "",
    };

    /*
    |--------------------------------------------------------------------------
    | VALIDATE GENERATED RESULT
    |--------------------------------------------------------------------------
    */

    if (
      wantsReel &&
      !result.reelScript
    ) {
      throw new Error(
        "Postoll was unable to generate the Reel Script."
      );
    }

    if (
      wantsPost &&
      !result.postScript
    ) {
      throw new Error(
        "Postoll was unable to generate the Post Script."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,

      reelScript:
        result.reelScript,

      postScript:
        result.postScript,
    });
  } catch (error: unknown) {
    console.error(
      "Generate workflow scripts error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate workflow scripts.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
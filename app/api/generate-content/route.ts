import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { GoogleGenAI } from "@google/genai";

type ContentType = "post" | "reel";

type GeneratedPost = {
  title: string;
  caption: string;
  hashtags: string[];
  imagePrompt: string;
};

type GeneratedReelScene = {
  sceneNumber: number;
  durationSeconds: number;
  visual: string;
  voiceover: string;
  onScreenText: string;
};

type GeneratedReel = {
  title: string;
  caption: string;
  hashtags: string[];
  hook: string;
  totalDurationSeconds: number;
  scenes: GeneratedReelScene[];
};

type GeneratedContent =
  | {
      type: "post";
      post: GeneratedPost;
    }
  | {
      type: "reel";
      reel: GeneratedReel;
    };

const postSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["post"],
    },
    post: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        caption: {
          type: "string",
        },
        hashtags: {
          type: "array",
          items: {
            type: "string",
          },
        },
        imagePrompt: {
          type: "string",
        },
      },
      required: [
        "title",
        "caption",
        "hashtags",
        "imagePrompt",
      ],
    },
  },
  required: ["type", "post"],
};

const reelSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["reel"],
    },
    reel: {
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        caption: {
          type: "string",
        },
        hashtags: {
          type: "array",
          items: {
            type: "string",
          },
        },
        hook: {
          type: "string",
        },
        totalDurationSeconds: {
          type: "integer",
        },
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sceneNumber: {
                type: "integer",
              },
              durationSeconds: {
                type: "integer",
              },
              visual: {
                type: "string",
              },
              voiceover: {
                type: "string",
              },
              onScreenText: {
                type: "string",
              },
            },
            required: [
              "sceneNumber",
              "durationSeconds",
              "visual",
              "voiceover",
              "onScreenText",
            ],
          },
        },
      },
      required: [
        "title",
        "caption",
        "hashtags",
        "hook",
        "totalDurationSeconds",
        "scenes",
      ],
    },
  },
  required: ["type", "reel"],
};

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            // Cookie updates can fail in some server contexts.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

function cleanHashtags(
  hashtags: unknown
): string[] {
  if (!Array.isArray(hashtags)) {
    return [];
  }

  return hashtags
    .map((item) =>
      String(item)
        .trim()
        .replace(/^#+/, "")
    )
    .filter(Boolean)
    .slice(0, 15);
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const {
      contentType,
      topic,
      brandName,
      audience,
      tone,
      language,
    } = body;

    if (
      contentType !== "post" &&
      contentType !== "reel"
    ) {
      return NextResponse.json(
        {
          error:
            "Please choose either Post or Reel.",
        },
        { status: 400 }
      );
    }

    if (
      typeof topic !== "string" ||
      !topic.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Please tell Postoll what you want to create.",
        },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to create content.",
        },
        { status: 401 }
      );
    }

    const geminiKey =
      process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is missing from .env.local.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
    });

    const safeBrand =
      typeof brandName === "string"
        ? brandName.trim()
        : "";

    const safeAudience =
      typeof audience === "string"
        ? audience.trim()
        : "";

    const safeTone =
      typeof tone === "string"
        ? tone
        : "Professional";

    const safeLanguage =
      typeof language === "string"
        ? language
        : "English";

    let schema;
    let prompt;

    if (contentType === "post") {
      schema = postSchema;

      prompt = `
You are Postoll, an AI social media content strategist.

Create a high-quality social media POST.

USER REQUEST:
${topic.trim()}

BRAND:
${safeBrand || "Not provided"}

TARGET AUDIENCE:
${safeAudience || "General audience"}

TONE:
${safeTone}

LANGUAGE:
${safeLanguage}

Requirements:

1. Create a strong, concise title.
2. Write a natural social media caption.
3. Generate relevant hashtags.
4. Create a detailed image-generation prompt.
5. The image prompt should describe composition, subject,
   lighting, camera/style, environment, colors and mood.
6. Do not put hashtags inside the caption.
7. Return ONLY the requested JSON structure.
`;
    } else {
      schema = reelSchema;

      prompt = `
You are Postoll, an AI social media content strategist,
short-form video scriptwriter and creative director.

Create a high-quality social media REEL.

USER REQUEST:
${topic.trim()}

BRAND:
${safeBrand || "Not provided"}

TARGET AUDIENCE:
${safeAudience || "General audience"}

TONE:
${safeTone}

LANGUAGE:
${safeLanguage}

Requirements:

1. Create a strong reel title.
2. Create a powerful opening hook.
3. Create a social media caption.
4. Generate relevant hashtags.
5. Create a short-form reel with approximately
   3 to 4 scenes.
6. Total duration should be approximately 30 seconds.
7. Every scene must contain:
   - scene number
   - duration
   - visual direction
   - voiceover
   - on-screen text
8. The scenes should flow naturally from beginning to end.
9. Make the content suitable for short-form social media.
10. Keep the voiceover conversational.
11. The detailed scene information is INTERNAL production
    information for Postoll and will be stored privately.
12. Return ONLY the requested JSON structure.
`;
    }

    const response =
      await ai.models.generateContent({
        model: "gemini-2.5-flash",

        contents: prompt,

        config: {
          responseMimeType:
            "application/json",

          responseSchema: schema,
        },
      });

    const rawText =
      response.text?.trim();

    if (!rawText) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    let generated: GeneratedContent;

    try {
      generated = JSON.parse(
        rawText
      ) as GeneratedContent;
    } catch {
      console.error(
        "Gemini returned invalid JSON:",
        rawText
      );

      throw new Error(
        "The AI returned an invalid content plan."
      );
    }

    /*
     * Normalize the generated result.
     */

    if (
      generated.type === "post" &&
      generated.post
    ) {
      generated.post.hashtags =
        cleanHashtags(
          generated.post.hashtags
        );
    }

    if (
      generated.type === "reel" &&
      generated.reel
    ) {
      generated.reel.hashtags =
        cleanHashtags(
          generated.reel.hashtags
        );
    }

    /*
     * IMPORTANT:
     *
     * We store the complete AI plan inside the existing
     * `content.plan` JSON field.
     *
     * This means the detailed script/scenes do NOT have
     * to become separate database columns.
     */

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (
      !serviceRoleKey ||
      !supabaseUrl
    ) {
      throw new Error(
        "Supabase server environment variables are missing."
      );
    }

    /*
     * Use the service role ONLY on the server.
     */
    const { createClient } =
      await import("@supabase/supabase-js");

    const adminSupabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    const publicPlan =
      generated.type === "post"
        ? {
            type: "post",
            title:
              generated.post.title,
            caption:
              generated.post.caption,
            hashtags:
              generated.post.hashtags,
            imagePrompt:
              generated.post.imagePrompt,
          }
        : {
            type: "reel",
            title:
              generated.reel.title,
            caption:
              generated.reel.caption,
            hashtags:
              generated.reel.hashtags,
            hook:
              generated.reel.hook,
            totalDurationSeconds:
              generated.reel
                .totalDurationSeconds,
          };

    /*
     * Internal plan.
     *
     * The complete reel script/scenes remain here.
     * The user-facing UI does not need to display this.
     */
    const internalPlan =
      generated.type === "reel"
        ? {
            ...publicPlan,
            internal: {
              scenes:
                generated.reel.scenes,
            },
          }
        : {
            ...publicPlan,
            internal: {},
          };

    /*
     * We deliberately insert only fields that are part of
     * the existing content structure we have already established:
     * user_id + plan.
     *
     * No new database columns are required for the AI plan.
     */
    const { data: savedContent, error: saveError } =
      await adminSupabase
        .from("content")
        .insert({
          user_id: user.id,
          plan: internalPlan,
        })
        .select("id")
        .single();

    if (saveError) {
      console.error(
        "Content save error:",
        saveError
      );

      throw new Error(
        `AI generated successfully, but saving failed: ${saveError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      contentId: savedContent.id,
      contentType,
      content: publicPlan,
    });
  } catch (error) {
    console.error(
      "Generate content error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating content.",
      },
      { status: 500 }
    );
  }
}
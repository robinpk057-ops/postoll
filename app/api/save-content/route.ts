import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
 * ================================================================
 * TYPES
 * ================================================================
 */

type SaveContentBody = {
  type?: "post" | "reel";

  idea?: string;

  plan?: {
    title?: string;
    concept?: string;
    creativeIntent?: string;
    imageDirection?: string;
    caption?: string;
    hashtags?: string[];

    [key: string]: unknown;
  };

  image?: string | null;
};

/*
 * ================================================================
 * BASE64 IMAGE DECODER
 * ================================================================
 */

function decodeBase64Image(
  value: string
): {
  buffer: Buffer;
  contentType: string;
  extension: string;
} | null {
  try {
    /*
     * Expected:
     *
     * data:image/png;base64,AAAA...
     */

    const match = value.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return null;
    }

    const contentType = match[1];
    const base64Data = match[2];

    const buffer =
      Buffer.from(base64Data, "base64");

    if (!buffer.length) {
      return null;
    }

    let extension = "png";

    if (contentType === "image/jpeg") {
      extension = "jpg";
    } else if (
      contentType === "image/webp"
    ) {
      extension = "webp";
    } else if (
      contentType === "image/gif"
    ) {
      extension = "gif";
    } else if (
      contentType === "image/avif"
    ) {
      extension = "avif";
    }

    return {
      buffer,
      contentType,
      extension,
    };
  } catch (error) {
    console.error(
      "Base64 image decode error:",
      error
    );

    return null;
  }
}

/*
 * ================================================================
 * POST
 * ================================================================
 */

export async function POST(
  request: Request
) {
  try {
    /*
     * ------------------------------------------------------------
     * SUPABASE ENVIRONMENT
     * ------------------------------------------------------------
     */

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publishableKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local",
        },
        { status: 500 }
      );
    }

    if (!publishableKey) {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing from .env.local",
        },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local",
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------------------
     * AUTHENTICATED SUPABASE CLIENT
     * ------------------------------------------------------------
     */

    const cookieStore =
      await cookies();

    const authSupabase =
      createServerClient(
        supabaseUrl,
        publishableKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },

            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(
                  ({
                    name,
                    value,
                    options,
                  }) => {
                    cookieStore.set(
                      name,
                      value,
                      options
                    );
                  }
                );
              } catch {
                /*
                 * Server Components / route
                 * handlers may not always be
                 * able to write cookies.
                 */
              }
            },
          },
        }
      );

    /*
     * ------------------------------------------------------------
     * GET CURRENT USER
     * ------------------------------------------------------------
     */

    const {
      data: { user },
      error: userError,
    } =
      await authSupabase.auth.getUser();

    if (userError) {
      console.error(
        "Supabase authentication error:",
        userError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your Postoll account.",
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "You must be logged in to save content.",
        },
        { status: 401 }
      );
    }

    /*
     * ------------------------------------------------------------
     * REQUEST BODY
     * ------------------------------------------------------------
     */

    const body =
      (await request.json()) as SaveContentBody;

    const {
      type = "post",
      idea = "",
      plan,
      image,
    } = body;

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "Content plan is required.",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * SUPABASE ADMIN CLIENT
     *
     * Service role is SERVER ONLY.
     * Never expose this key to the browser.
     * ------------------------------------------------------------
     */

    const supabaseAdmin =
      createSupabaseClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    /*
     * ------------------------------------------------------------
     * IMAGE STORAGE
     * ------------------------------------------------------------
     *
     * Generated images currently arrive as:
     *
     * data:image/png;base64,...
     *
     * Instagram cannot fetch a data URL.
     *
     * Therefore:
     *
     * base64
     *   ↓
     * Buffer
     *   ↓
     * Supabase Storage
     *   ↓
     * public HTTPS URL
     */

    let imageUrl: string | null =
      null;

    if (
      typeof image === "string" &&
      image.trim()
    ) {
      /*
       * ----------------------------------------------------------
       * CASE 1: BASE64 IMAGE
       * ----------------------------------------------------------
       */

      const decoded =
        decodeBase64Image(
          image
        );

      if (decoded) {
        const fileName =
          `${user.id}/${crypto.randomUUID()}.${decoded.extension}`;

        const {
          error: uploadError,
        } =
          await supabaseAdmin.storage
            .from("postoll-media")
            .upload(
              fileName,
              decoded.buffer,
              {
                contentType:
                  decoded.contentType,

                upsert: false,

                cacheControl:
                  "3600",
              }
            );

        if (uploadError) {
          console.error(
            "Supabase image upload error:",
            uploadError
          );

          return NextResponse.json(
            {
              error:
                "Unable to upload generated image to storage.",
              details:
                uploadError.message,
            },
            { status: 500 }
          );
        }

        /*
         * --------------------------------------------------------
         * GET PUBLIC URL
         * --------------------------------------------------------
         */

        const {
          data: publicUrlData,
        } =
          supabaseAdmin.storage
            .from("postoll-media")
            .getPublicUrl(
              fileName
            );

        imageUrl =
          publicUrlData.publicUrl;
      } else {
        /*
         * --------------------------------------------------------
         * CASE 2: ALREADY A NORMAL URL
         * --------------------------------------------------------
         *
         * If a future image generator returns
         * an HTTPS URL instead of base64,
         * keep it as-is.
         */

        if (
          image.startsWith(
            "https://"
          ) ||
          image.startsWith(
            "http://"
          )
        ) {
          imageUrl =
            image;
        } else {
          return NextResponse.json(
            {
              error:
                "The supplied image is neither a valid base64 image nor a public image URL.",
            },
            { status: 400 }
          );
        }
      }
    }

    /*
     * ------------------------------------------------------------
     * CONTENT RECORD
     * ------------------------------------------------------------
     */

    const contentRecord = {
      /*
       * IMPORTANT:
       * Use the REAL authenticated
       * user's UUID.
       */

      user_id: user.id,

      type,

      platform: null,

      title:
        typeof plan.title ===
        "string"
          ? plan.title
          : null,

      idea:
        idea.trim() || null,

      concept:
        typeof plan.concept ===
        "string"
          ? plan.concept
          : null,

      creative_intent:
        typeof plan.creativeIntent ===
        "string"
          ? plan.creativeIntent
          : null,

      image_direction:
        typeof plan.imageDirection ===
        "string"
          ? plan.imageDirection
          : null,

      plan,

      /*
       * IMPORTANT:
       *
       * This is now the PUBLIC HTTPS
       * Supabase Storage URL.
       *
       * Instagram can fetch this URL.
       */

      image_url: imageUrl,

      caption:
        typeof plan.caption ===
        "string"
          ? plan.caption
          : null,

      hashtags:
        Array.isArray(
          plan.hashtags
        )
          ? plan.hashtags
          : [],

      status: "approved",
    };

    /*
     * ------------------------------------------------------------
     * SAVE CONTENT
     * ------------------------------------------------------------
     */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("content")
        .insert(
          contentRecord
        )
        .select()
        .single();

    if (error) {
      console.error(
        "Supabase save content error:",
        error
      );

      /*
       * If content saving fails after
       * image upload, the image remains
       * in storage. That's acceptable
       * for now and can be cleaned up
       * later with a background cleanup
       * process.
       */

      return NextResponse.json(
        {
          error:
            error.message ||
            "Unable to save content.",
        },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------------------
     * SUCCESS
     * ------------------------------------------------------------
     */

    console.log(
      "Content saved successfully:",
      data?.id,
      "for user:",
      user.id
    );

    return NextResponse.json({
      success: true,

      content: data,

      /*
       * Useful for testing and
       * future publishing.
       */

      imageUrl,
    });
  } catch (error) {
    console.error(
      "Save content error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save content.",
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function decodeBase64Image(value: string): {
  buffer: Buffer;
  contentType: string;
} | null {
  try {
    if (!value) {
      return null;
    }

    // data:image/png;base64,...
    if (value.startsWith("data:")) {
      const commaIndex = value.indexOf(",");

      if (commaIndex === -1) {
        return null;
      }

      const header = value.slice(0, commaIndex);
      const base64 = value.slice(commaIndex + 1);

      const contentType =
        header.match(/^data:([^;]+);base64$/)?.[1] ||
        "image/png";

      return {
        buffer: Buffer.from(base64, "base64"),
        contentType,
      };
    }

    // Plain base64 fallback
    return {
      buffer: Buffer.from(value, "base64"),
      contentType: "image/png",
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Content ID is required.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    /*
     * ------------------------------------------------------------
     * AUTHENTICATED USER
     * ------------------------------------------------------------
     */

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        {
          error: userError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    /*
     * ------------------------------------------------------------
     * LOAD ONLY THE IMAGE FIELD
     * ------------------------------------------------------------
     */

    const {
      data: content,
      error: contentError,
    } = await supabase
      .from("content")
      .select("id,user_id,image_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (contentError) {
      console.error(
        "Content image database error:",
        contentError
      );

      return NextResponse.json(
        {
          error: contentError.message,
        },
        { status: 404 }
      );
    }

    if (!content?.image_url) {
      return NextResponse.json(
        {
          error: "No image found.",
        },
        { status: 404 }
      );
    }

    /*
     * ------------------------------------------------------------
     * CASE 1
     *
     * Already a normal URL.
     * ------------------------------------------------------------
     */

    if (
      content.image_url.startsWith("http://") ||
      content.image_url.startsWith("https://")
    ) {
      return NextResponse.redirect(
        content.image_url
      );
    }

    /*
     * ------------------------------------------------------------
     * CASE 2
     *
     * Existing record contains base64.
     *
     * Decode it and return it directly.
     *
     * We intentionally DO NOT send the base64 through
     * the Content page.
     * ------------------------------------------------------------
     */

    const decoded = decodeBase64Image(
      content.image_url
    );

    if (!decoded) {
      return NextResponse.json(
        {
          error: "Invalid image data.",
        },
        { status: 500 }
      );
    }

    return new NextResponse(
      new Uint8Array(decoded.buffer),
      {
        status: 200,
        headers: {
          "Content-Type": decoded.contentType,
          "Cache-Control":
            "private, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error(
      "Content image route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load image.",
      },
      { status: 500 }
    );
  }
}
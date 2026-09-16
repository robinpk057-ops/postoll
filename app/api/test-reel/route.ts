import { NextResponse } from "next/server";

const GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || "v25.0";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is missing from .env.local`
    );
  }

  return value;
}

async function graphRequest(
  url: string,
  options?: RequestInit
) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
  });

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    console.error(
      "Instagram Graph API error:",
      data
    );

    throw new Error(
      data?.error?.message ||
        data?.message ||
        "Instagram API request failed."
    );
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const videoUrl =
      typeof body.videoUrl === "string"
        ? body.videoUrl.trim()
        : "";

    const caption =
      typeof body.caption === "string"
        ? body.caption.trim()
        : "";

    if (!videoUrl) {
      return NextResponse.json(
        {
          error:
            "videoUrl is required.",
        },
        { status: 400 }
      );
    }

    if (!videoUrl.startsWith("https://")) {
      return NextResponse.json(
        {
          error:
            "Instagram requires a publicly accessible HTTPS video URL.",
        },
        { status: 400 }
      );
    }

    const accessToken =
      getEnv("INSTAGRAM_ACCESS_TOKEN");

    const instagramUserId =
      getEnv("INSTAGRAM_USER_ID");

    console.log(
      "[Postoll] Creating Instagram Reel container..."
    );

    /*
     * --------------------------------------------------
     * STEP 1
     * Create Instagram Reel container
     * --------------------------------------------------
     */

    const containerParams =
      new URLSearchParams();

    containerParams.set(
      "media_type",
      "REELS"
    );

    containerParams.set(
      "video_url",
      videoUrl
    );

    containerParams.set(
      "share_to_feed",
      "true"
    );

    if (caption) {
      containerParams.set(
        "caption",
        caption
      );
    }

    containerParams.set(
      "access_token",
      accessToken
    );

    const containerUrl =
      `https://graph.instagram.com/${GRAPH_VERSION}/${instagramUserId}/media?${containerParams.toString()}`;

    const container =
      await graphRequest(
        containerUrl,
        {
          method: "POST",
        }
      );

    const creationId =
      container?.id;

    if (!creationId) {
      throw new Error(
        "Instagram did not return a Reel container ID."
      );
    }

    console.log(
      "[Postoll] Reel container created:",
      creationId
    );

    /*
     * --------------------------------------------------
     * STEP 2
     * Wait for Instagram processing
     * --------------------------------------------------
     */

    let status = "";
    let statusMessage = "";

    const maxAttempts = 30;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      console.log(
        `[Postoll] Checking Instagram Reel status ${attempt}/${maxAttempts}...`
      );

      const statusUrl =
        `https://graph.instagram.com/${GRAPH_VERSION}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`;

      const statusResponse =
        await graphRequest(
          statusUrl,
          {
            method: "GET",
          }
        );

      status =
        statusResponse?.status_code ||
        "";

      statusMessage =
        statusResponse?.status ||
        "";

      console.log(
        "[Postoll] Instagram status:",
        status,
        statusMessage
      );

      if (status === "FINISHED") {
        break;
      }

      if (
        status === "ERROR" ||
        status === "EXPIRED"
      ) {
        throw new Error(
          statusMessage ||
            `Instagram Reel processing failed with status ${status}.`
        );
      }

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 5000)
      );
    }

    if (status !== "FINISHED") {
      throw new Error(
        "Instagram Reel is still processing. Try publishing again shortly."
      );
    }

    /*
     * --------------------------------------------------
     * STEP 3
     * Publish Reel
     * --------------------------------------------------
     */

    console.log(
      "[Postoll] Publishing Instagram Reel..."
    );

    const publishParams =
      new URLSearchParams();

    publishParams.set(
      "creation_id",
      creationId
    );

    publishParams.set(
      "access_token",
      accessToken
    );

    const publishUrl =
      `https://graph.instagram.com/${GRAPH_VERSION}/${instagramUserId}/media_publish?${publishParams.toString()}`;

    const published =
      await graphRequest(
        publishUrl,
        {
          method: "POST",
        }
      );

    const mediaId =
      published?.id;

    if (!mediaId) {
      throw new Error(
        "Instagram did not return a published media ID."
      );
    }

    console.log(
      "[Postoll] Instagram Reel published:",
      mediaId
    );

    return NextResponse.json({
      success: true,
      mediaId,
      creationId,
      message:
        "Instagram Reel published successfully.",
    });
  } catch (error) {
    console.error(
      "[Postoll] Instagram Reel publish error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish Instagram Reel.",
      },
      {
        status: 500,
      }
    );
  }
}
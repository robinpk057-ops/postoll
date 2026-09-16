import { NextResponse } from "next/server";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

type GenerateImageBody = {
  plan?: {
    title?: string;
    concept?: string;
    caption?: string;
    type?: "post" | "reel";
    creativeIntent?: string;

    visualStrategy?: {
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

    textStrategy?: {
      textRequired?: boolean;
      reason?: string;
      requestedText?: string;
      placement?: string;
      style?: string;
    };

    brandingStrategy?: {
      brandMentioned?: boolean;
      brandName?: string;
      logoRequired?: boolean;
    };

    imageDirection?: string;
    avoid?: string[];

    scenes?: {
      scene: number;
      description: string;
      duration: string;
    }[];
  };

  // Backwards compatibility
  title?: string;
  concept?: string;
  caption?: string;
  type?: "post" | "reel";
  imagePrompt?: string;
};

function decodeBase64Image(value: string): Buffer | null {
  try {
    if (!value) {
      return null;
    }

    if (value.startsWith("data:")) {
      const commaIndex = value.indexOf(",");

      if (commaIndex === -1) {
        return null;
      }

      const base64 = value.slice(commaIndex + 1);

      return Buffer.from(base64, "base64");
    }

    return Buffer.from(value, "base64");
  } catch (error) {
    console.error(
      "[Postoll] Base64 image decode error:",
      error
    );

    return null;
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function calculateFontSize(
  width: number,
  text: string
): number {
  const length = text.length;

  let size = Math.round(width * 0.075);

  if (length > 35) {
    size = Math.round(width * 0.06);
  }

  if (length > 55) {
    size = Math.round(width * 0.05);
  }

  if (length > 80) {
    size = Math.round(width * 0.042);
  }

  return Math.max(
    28,
    Math.min(size, 92)
  );
}

function getTextPosition(
  placement: string | undefined,
  width: number,
  height: number
): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  vertical: "top" | "center" | "bottom";
} {
  const value = (placement || "").toLowerCase();

  if (
    value.includes("top left") ||
    value.includes("upper left")
  ) {
    return {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.14),
      anchor: "start",
      vertical: "top",
    };
  }

  if (
    value.includes("top right") ||
    value.includes("upper right")
  ) {
    return {
      x: Math.round(width * 0.92),
      y: Math.round(height * 0.14),
      anchor: "end",
      vertical: "top",
    };
  }

  if (
    value.includes("bottom left") ||
    value.includes("lower left")
  ) {
    return {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.9),
      anchor: "start",
      vertical: "bottom",
    };
  }

  if (
    value.includes("bottom right") ||
    value.includes("lower right")
  ) {
    return {
      x: Math.round(width * 0.92),
      y: Math.round(height * 0.9),
      anchor: "end",
      vertical: "bottom",
    };
  }

  if (
    value.includes("center") ||
    value.includes("middle")
  ) {
    return {
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      anchor: "middle",
      vertical: "center",
    };
  }

  return {
    x: Math.round(width / 2),
    y: Math.round(height * 0.88),
    anchor: "middle",
    vertical: "bottom",
  };
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const averageCharacterWidth =
    fontSize * 0.55;

  const maxCharacters = Math.max(
    10,
    Math.floor(
      maxWidth / averageCharacterWidth
    )
  );

  const words = text.split(/\s+/);

  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (
      candidate.length <=
      maxCharacters
    ) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length
    ? lines
    : [text];
}

function shouldUseBackplate(
  style?: string
): boolean {
  const value = (style || "").toLowerCase();

  if (
    value.includes("no background") ||
    value.includes("without background")
  ) {
    return false;
  }

  if (
    value.includes("minimal") ||
    value.includes("clean typography")
  ) {
    return false;
  }

  return true;
}

async function addExactText(
  imageBuffer: Buffer,
  text: string,
  placement?: string,
  style?: string
): Promise<Buffer> {
  const metadata =
    await sharp(imageBuffer).metadata();

  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  const fontSize =
    calculateFontSize(
      width,
      text
    );

  const position =
    getTextPosition(
      placement,
      width,
      height
    );

  const maxTextWidth =
    Math.floor(width * 0.82);

  const lines =
    wrapText(
      text,
      maxTextWidth,
      fontSize
    );

  const lineHeight =
    Math.round(fontSize * 1.15);

  const totalTextHeight =
    lines.length * lineHeight;

  let startY = position.y;

  if (
    position.vertical ===
    "center"
  ) {
    startY =
      position.y -
      totalTextHeight / 2 +
      fontSize;
  }

  if (
    position.vertical ===
    "bottom"
  ) {
    startY =
      position.y -
      totalTextHeight;
  }

  const fontFamily =
    "Arial, Helvetica, sans-serif";

  const fontWeight = "700";

  const fill = "#ffffff";
  const stroke = "#000000";
  const strokeWidth = 1.5;

  const escapedLines =
    lines
      .map(
        (line, index) => {
          const y =
            startY +
            index *
              lineHeight;

          return `
            <text
              x="${position.x}"
              y="${y}"
              text-anchor="${position.anchor}"
              font-family="${fontFamily}"
              font-size="${fontSize}px"
              font-weight="${fontWeight}"
              fill="${fill}"
              stroke="${stroke}"
              stroke-width="${strokeWidth}"
              paint-order="stroke"
              stroke-linejoin="round"
            >${escapeXml(line)}</text>
          `;
        }
      )
      .join("");

  const addBackplate =
    shouldUseBackplate(style);

  let backplate = "";

  if (addBackplate) {
    const boxWidth =
      Math.min(
        width * 0.88,
        maxTextWidth + 80
      );

    const boxHeight =
      totalTextHeight + 50;

    let boxX =
      position.x -
      boxWidth / 2;

    if (
      position.anchor ===
      "start"
    ) {
      boxX =
        position.x - 30;
    }

    if (
      position.anchor ===
      "end"
    ) {
      boxX =
        position.x -
        boxWidth +
        30;
    }

    let boxY =
      startY -
      fontSize -
      25;

    if (
      position.vertical ===
      "center"
    ) {
      boxY =
        startY -
        fontSize -
        25;
    }

    backplate = `
      <rect
        x="${Math.max(20, boxX)}"
        y="${Math.max(20, boxY)}"
        width="${Math.min(
          boxWidth,
          width - 40
        )}"
        height="${boxHeight}"
        rx="22"
        fill="rgba(0,0,0,0.38)"
      />
    `;
  }

  const svg = `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${backplate}
      ${escapedLines}
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as GenerateImageBody;

    // ============================================================
    // GET PLAN
    // ============================================================

    const plan = body.plan;

    // Backwards compatibility
    const title =
      plan?.title ||
      body.title ||
      "";

    const concept =
      plan?.concept ||
      body.concept ||
      "";

    const type =
      plan?.type ||
      body.type ||
      "post";

    const creativeIntent =
      plan?.creativeIntent ||
      "";

    const visualStrategy =
      plan?.visualStrategy;

    const textStrategy =
      plan?.textStrategy;

    const brandingStrategy =
      plan?.brandingStrategy;

    const imageDirection =
      plan?.imageDirection ||
      "";

    const avoid =
      plan?.avoid ||
      [];

    // ============================================================
    // EXACT TEXT EXTRACTION
    // ============================================================

    const textRequired =
      textStrategy?.textRequired === true;

    const requestedText =
      typeof textStrategy?.requestedText ===
      "string"
        ? textStrategy.requestedText.trim()
        : "";

    const shouldRenderText =
      textRequired &&
      requestedText.length > 0;

    console.log(
      "[Postoll] Text required:",
      textRequired
    );

    console.log(
      "[Postoll] Requested text:",
      requestedText
    );

    console.log(
      "[Postoll] Render exact text:",
      shouldRenderText
    );

    // ============================================================
    // VISUAL STRATEGY
    // ============================================================

    const mainSubject =
      visualStrategy?.mainSubject ||
      concept ||
      title ||
      "the requested subject";

    const secondarySubjects =
      Array.isArray(
        visualStrategy?.secondarySubjects
      )
        ? visualStrategy.secondarySubjects
            .filter(Boolean)
            .slice(0, 5)
            .join(", ")
        : "";

    const environment =
      visualStrategy?.environment ||
      "";

    const action =
      visualStrategy?.action ||
      "";

    const mood =
      visualStrategy?.mood ||
      "";

    const visualStyle =
      visualStrategy?.visualStyle ||
      "";

    const lighting =
      visualStrategy?.lighting ||
      "";

    const composition =
      visualStrategy?.composition ||
      "";

    const camera =
      visualStrategy?.camera ||
      "";

    const colorDirection =
      visualStrategy?.colorDirection ||
      "";

    // ============================================================
    // BRAND
    // ============================================================

    const brandMentioned =
      brandingStrategy?.brandMentioned ===
      true;

    const brandName =
      brandingStrategy?.brandName?.trim() ||
      "";

    const logoRequired =
      brandingStrategy?.logoRequired ===
      true;

    // ============================================================
    // AVOID
    // ============================================================

    const avoidItems =
      Array.isArray(avoid)
        ? avoid
            .filter(Boolean)
            .slice(0, 10)
            .join(", ")
        : "";

    // ============================================================
    // BUILD DETAILED GEMINI IMAGE PROMPT
    // ============================================================

    let finalPrompt = `
Create a professional social media visual.

Generate ONLY the visual artwork/background.

Do NOT generate any words, letters, typography, captions,
headlines, slogans, logos, watermarks, labels or written text.

The final text will be added separately by Postoll.

MAIN SUBJECT:
${mainSubject}

CREATIVE INTENT:
${creativeIntent}

IMAGE DIRECTION:
${imageDirection}

SUPPORTING ELEMENTS:
${secondarySubjects}

ENVIRONMENT:
${environment}

ACTION:
${action}

MOOD:
${mood}

VISUAL STYLE:
${visualStyle}

LIGHTING:
${lighting}

COMPOSITION:
${composition}

CAMERA:
${camera}

COLOR DIRECTION:
${colorDirection}

CONTENT TYPE:
${type}

QUALITY:
- professional advertising photography
- high quality
- realistic materials
- realistic proportions
- believable perspective
- natural shadows
- professional lighting
- strong composition
- clear visual hierarchy
- visually understandable immediately
- polished social media creative
- no random objects
- no generic AI robotics
- no futuristic technology unless explicitly requested
- no sci-fi elements unless explicitly requested
- no watermark
- no logo
- no typography
- no letters
- no words
- no numbers
- no UI
- no border
`;

    // ============================================================
    // BRAND CONTEXT
    // ============================================================

    if (
      brandMentioned &&
      brandName
    ) {
      finalPrompt += `
BRAND CONTEXT:

The visual is related to the brand "${brandName}".

Do not create or invent the brand logo.
Do not invent brand typography.
Do not invent brand claims.
`;
    }

    // ============================================================
    // AVOID
    // ============================================================

    if (avoidItems) {
      finalPrompt += `
AVOID:
${avoidItems}
`;
    }

    // ============================================================
    // TEXT PROTECTION
    // ============================================================

    finalPrompt += `
IMPORTANT:

Generate a clean image without any text.

Postoll will add any required heading, quote,
slogan or other requested text after generation.

Do not attempt to spell or render any user-provided text.
`;

    finalPrompt =
      finalPrompt.trim();

    if (!finalPrompt) {
      return NextResponse.json(
        {
          error:
            "Unable to create an image prompt.",
        },
        { status: 400 }
      );
    }

    console.log(
      "[Postoll] Gemini prompt length:",
      finalPrompt.length
    );

    // ============================================================
    // GEMINI PRIMARY
    // ============================================================

    let imageBuffer:
      | Buffer
      | null = null;

    let providerUsed = "";

    const geminiApiKey =
      process.env.GEMINI_API_KEY;

    const geminiModel =
      process.env.GEMINI_IMAGE_MODEL ||
      "gemini-3.1-flash-image";

    if (geminiApiKey) {
      try {
        console.log(
          "================================="
        );

        console.log(
          "[Postoll] Gemini image request"
        );

        console.log(
          "[Postoll] Model:",
          geminiModel
        );

        console.log(
          "[Postoll] Prompt length:",
          finalPrompt.length
        );

        console.log(
          "================================="
        );

        const ai =
          new GoogleGenAI({
            apiKey:
              geminiApiKey,
          });

        const response =
          await ai.models.generateContent({
            model:
              geminiModel,

            contents:
              finalPrompt,

            config: {
              responseModalities: [
                "TEXT",
                "IMAGE",
              ],
            },
          });

        const parts =
          response
            .candidates?.[0]
            ?.content?.parts ||
          [];

        for (const part of parts) {
          const data =
            part.inlineData?.data;

          if (data) {
            imageBuffer =
              Buffer.from(
                data,
                "base64"
              );

            break;
          }
        }

        if (imageBuffer) {
          providerUsed =
            "gemini";

          console.log(
            "[Postoll] Gemini image generated successfully."
          );

          console.log(
            "[Postoll] Generated image bytes:",
            imageBuffer.length
          );
        } else {
          console.warn(
            "[Postoll] Gemini returned no image. Falling back to Cloudflare FLUX."
          );
        }
      } catch (error) {
        console.error(
          "[Postoll] Gemini image generation failed:",
          error
        );

        console.log(
          "[Postoll] Falling back to Cloudflare FLUX."
        );
      }
    } else {
      console.warn(
        "[Postoll] GEMINI_API_KEY is missing. Falling back to Cloudflare FLUX."
      );
    }

    // ============================================================
    // CLOUDFLARE FLUX FALLBACK
    // ============================================================

    if (!imageBuffer) {
      const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;

      const apiToken =
        process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        return NextResponse.json(
          {
            error:
              "Gemini image generation failed and Cloudflare FLUX fallback is not configured.",
          },
          { status: 500 }
        );
      }

      const model =
        "@cf/black-forest-labs/flux-1-schnell";

      const url =
        `https://api.cloudflare.com/client/v4/accounts/` +
        `${accountId}/ai/run/${model}`;

      // ============================================================
      // IMPORTANT:
      //
      // Cloudflare FLUX has a 2048 character prompt limit.
      //
      // Do NOT send the detailed Gemini prompt.
      //
      // Build a separate compact visual prompt.
      // ============================================================

      const cloudflarePrompt = `
Create a professional vertical social-media image.

Subject:
${mainSubject}

Supporting elements:
${secondarySubjects}

Environment:
${environment}

Action:
${action}

Mood:
${mood}

Visual style:
${visualStyle}

Lighting:
${lighting}

Composition:
${composition}

Camera:
${camera}

Color direction:
${colorDirection}

Creative intent:
${creativeIntent}

Image direction:
${imageDirection}

Requirements:
Professional advertising photography.
High quality.
Realistic proportions.
Natural lighting.
Natural shadows.
Strong composition.
Clear visual hierarchy.
Realistic materials.
Believable perspective.
No random objects.
No unnecessary people.
No futuristic elements unless requested.
No sci-fi elements unless requested.
No text.
No letters.
No numbers.
No typography.
No logo.
No watermark.
No UI.
No border.
`.trim();

      // Keep a safety margin below Cloudflare's
      // hard 2048-character limit.
      const safeCloudflarePrompt =
        cloudflarePrompt.length > 2000
          ? cloudflarePrompt.slice(
              0,
              2000
            )
          : cloudflarePrompt;

      console.log(
        "================================="
      );

      console.log(
        "[Postoll] Cloudflare FLUX fallback request"
      );

      console.log(
        "[Postoll] Model:",
        model
      );

      console.log(
        "[Postoll] Cloudflare prompt length:",
        safeCloudflarePrompt.length
      );

      console.log(
        "================================="
      );

      const cloudflareResponse =
        await fetch(url, {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiToken}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            prompt:
              safeCloudflarePrompt,
          }),
        });

      if (!cloudflareResponse.ok) {
        let errorMessage =
          "Cloudflare image generation failed.";

        try {
          const errorData =
            await cloudflareResponse.json();

          console.error(
            "[Postoll] Cloudflare error:",
            errorData
          );

          if (
            Array.isArray(
              errorData?.errors
            ) &&
            errorData.errors.length > 0
          ) {
            errorMessage =
              errorData.errors[0]?.message ||
              errorMessage;
          }
        } catch {
          try {
            const text =
              await cloudflareResponse.text();

            if (text) {
              errorMessage =
                text;
            }
          } catch {
            // Keep default error.
          }
        }

        return NextResponse.json(
          {
            error:
              errorMessage,

            provider:
              "cloudflare",
          },
          {
            status:
              cloudflareResponse.status ||
              500,
          }
        );
      }

      const contentType =
        cloudflareResponse.headers.get(
          "content-type"
        ) || "";

      console.log(
        "[Postoll] Cloudflare content type:",
        contentType
      );

      // ============================================================
      // DIRECT IMAGE RESPONSE
      // ============================================================

      if (
        contentType.includes("image/")
      ) {
        const arrayBuffer =
          await cloudflareResponse.arrayBuffer();

        imageBuffer =
          Buffer.from(
            arrayBuffer
          );
      }

      // ============================================================
      // JSON IMAGE RESPONSE
      // ============================================================

      if (!imageBuffer) {
        let data: any;

        try {
          data =
            await cloudflareResponse.json();
        } catch {
          return NextResponse.json(
            {
              error:
                "Cloudflare returned an invalid image response.",
            },
            { status: 500 }
          );
        }

        console.log(
          "[Postoll] Cloudflare image response:",
          data
        );

        const result =
          data?.result;

        if (
          typeof result?.image ===
          "string"
        ) {
          imageBuffer =
            decodeBase64Image(
              result.image
            );
        }

        if (
          !imageBuffer &&
          typeof result ===
            "string"
        ) {
          imageBuffer =
            decodeBase64Image(
              result
            );
        }

        if (
          !imageBuffer &&
          Array.isArray(
            result?.images
          ) &&
          result.images.length > 0
        ) {
          const firstImage =
            result.images[0];

          if (
            typeof firstImage ===
            "string"
          ) {
            imageBuffer =
              decodeBase64Image(
                firstImage
              );
          }
        }

        if (
          !imageBuffer &&
          typeof data?.image ===
            "string"
        ) {
          imageBuffer =
            decodeBase64Image(
              data.image
            );
        }
      }

      if (imageBuffer) {
        providerUsed =
          "cloudflare";

        console.log(
          "[Postoll] Cloudflare image generated successfully."
        );
      }
    }

    // ============================================================
    // VERIFY IMAGE
    // ============================================================

    if (!imageBuffer) {
      console.error(
        "[Postoll] Neither Gemini nor Cloudflare returned a usable image."
      );

      return NextResponse.json(
        {
          error:
            "Neither Gemini nor Cloudflare generated a usable image.",
        },
        { status: 500 }
      );
    }

    console.log(
      "[Postoll] Image provider used:",
      providerUsed
    );

    console.log(
      "[Postoll] Generated image bytes:",
      imageBuffer.length
    );

    // ============================================================
    // NO TEXT REQUIRED
    // ============================================================

    if (!shouldRenderText) {
      const base64 =
        imageBuffer.toString(
          "base64"
        );

      return NextResponse.json({
        image:
          `data:image/png;base64,${base64}`,

        textAdded:
          false,

        requestedText:
          "",

        provider:
          providerUsed,
      });
    }

    // ============================================================
    // EXACT USER TEXT
    // ============================================================

    console.log(
      "[Postoll] Rendering exact requested text with Sharp:"
    );

    console.log(
      requestedText
    );

    const finalImageBuffer =
      await addExactText(
        imageBuffer,
        requestedText,
        textStrategy?.placement,
        textStrategy?.style
      );

    const finalBase64 =
      finalImageBuffer.toString(
        "base64"
      );

    console.log(
      "[Postoll] Final image generated successfully."
    );

    return NextResponse.json({
      image:
        `data:image/png;base64,${finalBase64}`,

      textAdded:
        true,

      requestedText,

      provider:
        providerUsed,
    });
  } catch (error) {
    console.error(
      "[Postoll] Generate image error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate image.",
      },
      { status: 500 }
    );
  }
}
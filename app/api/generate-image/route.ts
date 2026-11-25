import { NextResponse } from "next/server";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

type SupportedAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

type GenerateImageBody = {
  aspectRatio?: SupportedAspectRatio;
  referenceImage?: string | null;
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
  };
  title?: string;
  concept?: string;
  caption?: string;
  type?: "post" | "reel";
};

function getTargetDimensions(aspectRatio: SupportedAspectRatio): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "9:16":
      return { width: 896, height: 1592 };
    case "16:9":
      return { width: 1408, height: 792 };
    case "4:5":
      return { width: 1024, height: 1280 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

function parseDataUrl(
  value: string
): { mimeType: string; base64: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
    value.trim()
  );
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function decodeBase64Image(value: string): Buffer | null {
  try {
    if (!value) return null;
    if (value.startsWith("data:")) {
      const commaIndex = value.indexOf(",");
      if (commaIndex === -1) return null;
      return Buffer.from(value.slice(commaIndex + 1), "base64");
    }
    return Buffer.from(value, "base64");
  } catch (error) {
    console.error("[Postoll] Base64 image decode error:", error);
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

function calculateFontSize(width: number, text: string): number {
  const length = text.length;
  let size = Math.round(width * 0.075);
  if (length > 35) size = Math.round(width * 0.06);
  if (length > 55) size = Math.round(width * 0.05);
  if (length > 80) size = Math.round(width * 0.042);
  return Math.max(28, Math.min(size, 92));
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
  if (value.includes("top left") || value.includes("upper left")) {
    return {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.14),
      anchor: "start",
      vertical: "top",
    };
  }
  if (value.includes("top right") || value.includes("upper right")) {
    return {
      x: Math.round(width * 0.92),
      y: Math.round(height * 0.14),
      anchor: "end",
      vertical: "top",
    };
  }
  if (value.includes("bottom left") || value.includes("lower left")) {
    return {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.9),
      anchor: "start",
      vertical: "bottom",
    };
  }
  if (value.includes("bottom right") || value.includes("lower right")) {
    return {
      x: Math.round(width * 0.92),
      y: Math.round(height * 0.9),
      anchor: "end",
      vertical: "bottom",
    };
  }
  if (value.includes("center") || value.includes("middle")) {
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

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const averageCharacterWidth = fontSize * 0.55;
  const maxCharacters = Math.max(10, Math.floor(maxWidth / averageCharacterWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function shouldUseBackplate(style?: string): boolean {
  const value = (style || "").toLowerCase();
  if (
    value.includes("no background") ||
    value.includes("without background") ||
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
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const fontSize = calculateFontSize(width, text);
  const position = getTextPosition(placement, width, height);
  const maxTextWidth = Math.floor(width * 0.82);
  const lines = wrapText(text, maxTextWidth, fontSize);
  const lineHeight = Math.round(fontSize * 1.15);
  const totalTextHeight = lines.length * lineHeight;

  let startY = position.y;
  if (position.vertical === "center") {
    startY = position.y - totalTextHeight / 2 + fontSize;
  }
  if (position.vertical === "bottom") {
    startY = position.y - totalTextHeight;
  }

  const fontFamily = "Arial, Helvetica, sans-serif";
  const fontWeight = "700";
  const fill = "#ffffff";
  const stroke = "#000000";
  const strokeWidth = 1.5;

  const escapedLines = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
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
    })
    .join("");

  const addBackplate = shouldUseBackplate(style);
  let backplate = "";

  if (addBackplate) {
    const boxWidth = Math.min(width * 0.88, maxTextWidth + 80);
    const boxHeight = totalTextHeight + 50;
    let boxX = position.x - boxWidth / 2;
    if (position.anchor === "start") boxX = position.x - 30;
    if (position.anchor === "end") boxX = position.x - boxWidth + 30;
    const boxY = startY - fontSize - 25;

    backplate = `
      <rect
        x="${Math.max(20, boxX)}"
        y="${Math.max(20, boxY)}"
        width="${Math.min(boxWidth, width - 40)}"
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
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateImageBody;
    const aspectRatio: SupportedAspectRatio =
      body.aspectRatio && ["1:1", "9:16", "16:9", "4:5"].includes(body.aspectRatio)
        ? body.aspectRatio
        : "1:1";
    const targetSize = getTargetDimensions(aspectRatio);

    const plan = body.plan;
    const title = plan?.title || body.title || "";
    const concept = plan?.concept || body.concept || "";
    const type = plan?.type || body.type || "post";
    const creativeIntent = plan?.creativeIntent || "";
    const visualStrategy = plan?.visualStrategy;
    const textStrategy = plan?.textStrategy;
    const brandingStrategy = plan?.brandingStrategy;
    const imageDirection = plan?.imageDirection || "";
    const avoid = plan?.avoid || [];

    const textRequired = textStrategy?.textRequired === true;
    const requestedText =
      typeof textStrategy?.requestedText === "string"
        ? textStrategy.requestedText.trim()
        : "";
    const shouldRenderText = textRequired && requestedText.length > 0;

    const mainSubject =
      visualStrategy?.mainSubject || concept || title || "the requested subject";
    const secondarySubjects = Array.isArray(visualStrategy?.secondarySubjects)
      ? visualStrategy.secondarySubjects.filter(Boolean).slice(0, 5).join(", ")
      : "";
    const environment = visualStrategy?.environment || "";
    const action = visualStrategy?.action || "";
    const mood = visualStrategy?.mood || "";
    const visualStyle = visualStrategy?.visualStyle || "";
    const lighting = visualStrategy?.lighting || "";
    const composition = visualStrategy?.composition || "";
    const camera = visualStrategy?.camera || "";
    const colorDirection = visualStrategy?.colorDirection || "";

    const brandMentioned = brandingStrategy?.brandMentioned === true;
    const brandName = brandingStrategy?.brandName?.trim() || "";
    const avoidItems = Array.isArray(avoid)
      ? avoid.filter(Boolean).slice(0, 10).join(", ")
      : "";

    let refInlineData: { mimeType: string; data: string } | null = null;
    if (typeof body.referenceImage === "string" && body.referenceImage.trim()) {
      const parsed = parseDataUrl(body.referenceImage);
      if (parsed) {
        refInlineData = { mimeType: parsed.mimeType, data: parsed.base64 };
      } else if (/^https?:\/\//i.test(body.referenceImage.trim())) {
        try {
          const imgRes = await fetch(body.referenceImage.trim());
          if (imgRes.ok) {
            const ct = imgRes.headers.get("content-type") || "image/jpeg";
            const buf = Buffer.from(await imgRes.arrayBuffer());
            refInlineData = {
              mimeType: ct.split(";")[0] || "image/jpeg",
              data: buf.toString("base64"),
            };
          }
        } catch {
          // Ignore optional reference image fetch failure
        }
      }
    }

    let finalPrompt = `
Create a professional studio visual in ${aspectRatio} aspect ratio (${targetSize.width}x${targetSize.height}).

Generate ONLY the visual artwork/background.
Do NOT generate any words, letters, typography, captions, headlines, slogans, logos, watermarks, labels or written text.

${
  refInlineData
    ? "REFERENCE IMAGE PROVIDED: Use the attached reference image as visual guidance for subject consistency, style, or product identity while fulfilling the prompt."
    : ""
}

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
- studio photography & digital art quality
- crisp detail, realistic materials, natural lighting & shadows
- no watermark, no logo, no random text, no UI
`.trim();

    if (brandMentioned && brandName) {
      finalPrompt += `\nBRAND CONTEXT:\nRelated to brand "${brandName}". Do not invent brand logos or typography.`;
    }
    if (avoidItems) {
      finalPrompt += `\nAVOID:\n${avoidItems}`;
    }

    let imageBuffer: Buffer | null = null;
    let providerUsed = "";

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel =
      process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const contents = refInlineData
          ? [
              {
                inlineData: {
                  mimeType: refInlineData.mimeType,
                  data: refInlineData.data,
                },
              },
              finalPrompt,
            ]
          : finalPrompt;

        const response = await ai.models.generateContent({
          model: geminiModel,
          contents,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          const data = part.inlineData?.data;
          if (data) {
            imageBuffer = Buffer.from(data, "base64");
            break;
          }
        }

        if (imageBuffer) {
          providerUsed = "gemini";
        }
      } catch (error) {
        console.error("[Postoll] Gemini image generation failed:", error);
      }
    }

    if (!imageBuffer) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        return NextResponse.json(
          {
            error:
              "Gemini image generation failed and Cloudflare FLUX fallback is not configured.",
          },
          { status: 500 }
        );
      }

      const model = "@cf/black-forest-labs/flux-1-schnell";
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const cloudflarePrompt = `
Create a ${aspectRatio} studio image.
Subject: ${mainSubject}
Environment: ${environment}
Action: ${action}
Mood: ${mood}
Style: ${visualStyle}
Lighting: ${lighting}
Color: ${colorDirection}
No text, no watermark, no logo.
`.trim().slice(0, 2000);

      const cloudflareResponse = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: cloudflarePrompt }),
      });

      if (!cloudflareResponse.ok) {
        return NextResponse.json(
          { error: "Cloudflare image generation failed.", provider: "cloudflare" },
          { status: cloudflareResponse.status || 500 }
        );
      }

      const contentType = cloudflareResponse.headers.get("content-type") || "";
      if (contentType.includes("image/")) {
        imageBuffer = Buffer.from(await cloudflareResponse.arrayBuffer());
      } else {
        const data = await cloudflareResponse.json().catch(() => ({}));
        const result = data?.result;
        if (typeof result?.image === "string") {
          imageBuffer = decodeBase64Image(result.image);
        } else if (typeof result === "string") {
          imageBuffer = decodeBase64Image(result);
        } else if (Array.isArray(result?.images) && typeof result.images[0] === "string") {
          imageBuffer = decodeBase64Image(result.images[0]);
        } else if (typeof data?.image === "string") {
          imageBuffer = decodeBase64Image(data.image);
        }
      }

      if (imageBuffer) {
        providerUsed = "cloudflare";
      }
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: "Unable to generate a usable image." },
        { status: 500 }
      );
    }

    // Resize/crop to requested aspect ratio cleanly
    imageBuffer = await sharp(imageBuffer)
      .resize(targetSize.width, targetSize.height, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();

    if (!shouldRenderText) {
      return NextResponse.json({
        image: `data:image/png;base64,${imageBuffer.toString("base64")}`,
        aspectRatio,
        width: targetSize.width,
        height: targetSize.height,
        textAdded: false,
        requestedText: "",
        provider: providerUsed,
      });
    }

    const finalImageBuffer = await addExactText(
      imageBuffer,
      requestedText,
      textStrategy?.placement,
      textStrategy?.style
    );

    return NextResponse.json({
      image: `data:image/png;base64,${finalImageBuffer.toString("base64")}`,
      aspectRatio,
      width: targetSize.width,
      height: targetSize.height,
      textAdded: true,
      requestedText,
      provider: providerUsed,
    });
  } catch (error) {
    console.error("[Postoll] Generate image error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to generate image.",
      },
      { status: 500 }
    );
  }
}

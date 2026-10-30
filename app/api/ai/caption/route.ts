import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export const maxDuration = 30;

type Body = {
  description: string;
  contentType?: "post" | "reel";
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const description = (body.description || "").trim();
    const contentType = body.contentType === "reel" ? "reel" : "post";

    if (!description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const model = process.env.GEMINI_PLAN_MODEL || "gemini-3.8-flash";

    const prompt = `You are a social media copywriter for Instagram.
Write a short caption (max 2 sentences) and 8-12 hashtags (no # symbol).

Content type: ${contentType}
User description:
"""
${description}
"""

Respond with ONLY valid JSON:
{"caption":"...","hashtags":["tag1","tag2"]}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini error:", geminiData);
      return NextResponse.json(
        {
          error:
            geminiData?.error?.message || "Gemini request failed",
        },
        { status: 502 }
      );
    }

    const parts = geminiData?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text || "").join("")
      : "";

    const finishReason = geminiData?.candidates?.[0]?.finishReason;
    const blockReason =
      geminiData?.promptFeedback?.blockReason ||
      geminiData?.candidates?.[0]?.safetyRatings;

    if (!text.trim()) {
      console.error(
        "Gemini empty response:",
        JSON.stringify(geminiData).slice(0, 2000)
      );
      return NextResponse.json(
        {
          error:
            finishReason === "SAFETY"
              ? "Gemini blocked the response (safety)."
              : geminiData?.error?.message ||
              "Gemini returned an empty response. Check API quota/billing and model name.",
          detail: { finishReason, blockReason },
        },
        { status: 502 }
      );
    }

    let parsed: { caption?: string; hashtags?: string[] } = {};
    try {
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return NextResponse.json(
            { error: "Could not parse AI response", raw: text.slice(0, 500) },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Could not parse AI response", raw: text.slice(0, 500) },
          { status: 502 }
        );
      }
    }

    const caption = String(parsed.caption || "").trim();
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags
        .map((t) => String(t).replace(/^#/, "").trim())
        .filter(Boolean)
        .slice(0, 15)
      : [];

    if (!caption) {
      return NextResponse.json(
        { error: "AI returned an empty caption" },
        { status: 502 }
      );
    }

    return NextResponse.json({ caption, hashtags });
  } catch (err) {
    console.error("ai/caption error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
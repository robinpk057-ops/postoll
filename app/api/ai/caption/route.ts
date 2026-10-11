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

    const model =
      process.env.GEMINI_PLAN_MODEL || "gemini-2.0-flash";

    const prompt = `You are a social media copywriter for Instagram.
Given the user's content description, write:
1) A short engaging caption (2-4 sentences max, natural tone, no quote marks around the whole caption)
2) 8-12 relevant hashtags without the # symbol in a JSON array

Content type: ${contentType}
User description:
"""
${description}
"""

Respond with ONLY valid JSON in this exact shape:
{"caption":"...","hashtags":["tag1","tag2"]}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
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
            geminiData?.error?.message ||
            "Gemini request failed",
        },
        { status: 502 }
      );
    }

    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed: { caption?: string; hashtags?: string[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json(
          { error: "Could not parse AI response" },
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
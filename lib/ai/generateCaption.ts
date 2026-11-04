export async function generateCaptionFromIdea(params: {
  description: string;
  contentType?: "post" | "reel";
  variationSeed?: string;
}): Promise<{ caption: string; hashtags: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_PLAN_MODEL || "gemini-3.8-flash";
  const description = params.description.trim();
  if (description.length < 3) return null;

  const contentType = params.contentType === "reel" ? "reel" : "post";
  const seed = params.variationSeed || Math.random().toString(36).slice(2);

  const prompt = `You are an Instagram copywriter.
Write a UNIQUE caption for this content idea (different wording each time).
Variation key: ${seed}
Content type: ${contentType}
Idea:
"""
${description}
"""
Rules:
- 2 short sentences max
- natural tone
- no quotation marks around the whole caption
- 8-12 hashtags without # in a JSON array
Return ONLY JSON: {"caption":"...","hashtags":["tag1","tag2"]}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) return null;

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    const caption = String(parsed.caption || "").trim();
    if (!caption) return null;

    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .map((t: string) => String(t).replace(/^#/, "").trim())
          .filter(Boolean)
      : [];

    return { caption, hashtags };
  } catch {
    return null;
  }
}
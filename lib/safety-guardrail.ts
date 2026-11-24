import { HarmBlockThreshold, HarmCategory } from "@google/genai";

const BLOCKED_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  {
    category: "Sexual / Pornographic Content",
    pattern: /\b(porn|pornography|nsfw|xxx|explicit\s+sex|erotic\s+nudity|hentai|onlyfans\s+nude)\b/i,
  },
  {
    category: "Child Safety Violation",
    pattern: /\b(csam|child\s*porn|child\s*sexual|minor\s*nudity|underage\s*(sex|nude|explicit))\b/i,
  },
  {
    category: "National Security / Severe Harm",
    pattern: /\b(bomb\s*making|build\s*a\s*bomb|explosive\s*recipe|assassinate|mass\s*shooting|chemical\s*weapon|biological\s*weapon|cyberattack\s*infrastructure|national\s*security\s*breach)\b/i,
  },
  {
    category: "Self-Harm",
    pattern: /\b(suicide\s*method|how\s*to\s*kill\s*yourself|self\s*-?harm\s*instructions)\b/i,
  },
];

export function validateSafetyText(text: string): { allowed: boolean; reason?: string } {
  const normalized = text.trim();
  if (!normalized) return { allowed: true };

  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      return {
        allowed: false,
        reason: `Content blocked by safety policy (${rule.category}). Prohibited sexual, child-safety, national security, or harmful material is not permitted.`,
      };
    }
  }

  return { allowed: true };
}

export const STRICT_GEMINI_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

export function assertGeminiResponseSafe(response: any): void {
  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Generation blocked by model safety policy (${blockReason}).`);
  }
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
    throw new Error(`Generated output blocked by safety filter (${finishReason}).`);
  }
}

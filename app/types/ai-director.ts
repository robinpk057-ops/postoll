export type ContentFormat = "video" | "image" | "carousel";

export type VisualStyle =
  | "brand"
  | "cartoon"
  | "nature"
  | "talking_character"
  | "storytime"
  | "educational";

export type AudioMode =
  | "voiceover_music"
  | "talking_character"
  | "music_only"
  | "none";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface DetailedBrief {
  goal: string; // e.g. "Drive product signups", "Grow romance story followers"
  coreIdea: string; // Main niche/story world the user wants to achieve
  charactersAndTone: string; // Recurring characters, brand voice, emotional tone
  pacingAndCta: string; // Hook style, narrative arc, call-to-action or product tie-in
  avoidRules?: string; // Things Gemini must never generate or mention
  storyArcNotes?: string; // Optional serialized plot memory (e.g., love story episodes)
}

export interface ReferenceAsset {
  id: string;
  url: string;
  kind: "product" | "character" | "style_example";
  label?: string;
  lockAcrossRuns: boolean; // true for product/character anchors; false for one-time style examples
}

export interface StyleBlueprint {
  pacingSummary: string; // e.g. "Fast 2-3s visual shifts, punchy hook in first 2s"
  cameraAndMotion: string; // e.g. "Slow push-in, handheld warmth, clean framing"
  moodAndTone: string;
  extractedAt: string;
}

export interface VoiceConfig {
  language: string; // e.g. "en", "hi", "es"
  preset: string; // e.g. "warm_clear", "energetic_creator", "calm_storyteller"
  voiceId?: string; // Optional provider voice override
}

export interface RecentAngleEntry {
  date: string; // YYYY-MM-DD
  hook: string;
  angleSummary: string;
}

export interface WorkflowDirectorSettings {
  id: string;
  content_format: ContentFormat;
  visual_style: VisualStyle;
  audio_mode: AudioMode;
  aspect_ratio: AspectRatio;
  duration_seconds: number;
  detailed_brief: DetailedBrief;
  reference_assets: ReferenceAsset[];
  style_blueprint: StyleBlueprint | null;
  voice_config: VoiceConfig;
  auto_publish: boolean;
  recent_angles: RecentAngleEntry[];
}

"use client";

import React, { useState } from "react";
import type {
  AspectRatio,
  AudioMode,
  ContentFormat,
  ReferenceAsset,
  VisualStyle,
  WorkflowDirectorSettings,
} from "@/app/types/ai-director";
import type { StoryboardPlan } from "@/app/api/ai-director/storyboard/route";

interface AiDirectorBuilderProps {
  initialSettings?: Partial<WorkflowDirectorSettings>;
  onSaveSettings?: (settings: WorkflowDirectorSettings) => Promise<void> | void;
}

const DEFAULT_SETTINGS: WorkflowDirectorSettings = {
  id: "draft-workflow",
  content_format: "video",
  visual_style: "brand",
  audio_mode: "voiceover_music",
  aspect_ratio: "9:16",
  duration_seconds: 30,
  detailed_brief: {
    goal: "",
    coreIdea: "",
    charactersAndTone: "",
    pacingAndCta: "",
    avoidRules: "",
    storyArcNotes: "",
  },
  reference_assets: [],
  style_blueprint: null,
  voice_config: {
    language: "en",
    preset: "warm_clear",
  },
  auto_publish: true,
  recent_angles: [],
};

export default function AiDirectorBuilder({
  initialSettings,
  onSaveSettings,
}: AiDirectorBuilderProps) {
  const [settings, setSettings] = useState<WorkflowDirectorSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
    detailed_brief: {
      ...DEFAULT_SETTINGS.detailed_brief,
      ...(initialSettings?.detailed_brief || {}),
    },
    voice_config: {
      ...DEFAULT_SETTINGS.voice_config,
      ...(initialSettings?.voice_config || {}),
    },
  });

  const [assetUrl, setAssetUrl] = useState("");
  const [assetLabel, setAssetLabel] = useState("");
  const [assetKind, setAssetKind] = useState<ReferenceAsset["kind"]>("product");

  const [storyboard, setStoryboard] = useState<StoryboardPlan | null>(null);
  const [loadingStoryboard, setLoadingStoryboard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function updateBrief<K extends keyof WorkflowDirectorSettings["detailed_brief"]>(
    key: K,
    value: string
  ) {
    setSettings((prev) => ({
      ...prev,
      detailed_brief: {
        ...prev.detailed_brief,
        [key]: value,
      },
    }));
  }

  function handleAddReferenceAsset() {
    const trimmedUrl = assetUrl.trim();
    if (!trimmedUrl) return;

    const newAsset: ReferenceAsset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: trimmedUrl,
      kind: assetKind,
      label: assetLabel.trim() || undefined,
      lockAcrossRuns: assetKind !== "style_example",
    };

    setSettings((prev) => ({
      ...prev,
      reference_assets: [...prev.reference_assets, newAsset],
    }));
    setAssetUrl("");
    setAssetLabel("");
  }

  function handleRemoveReferenceAsset(id: string) {
    setSettings((prev) => ({
      ...prev,
      reference_assets: prev.reference_assets.filter((item) => item.id !== id),
    }));
  }

  async function handleGenerateStoryboard() {
    setErrorMsg(null);
    setStatusMsg(null);
    setLoadingStoryboard(true);

    try {
      const res = await fetch("/api/ai-director/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate storyboard.");
      }

      setStoryboard(data.storyboard);
      setStatusMsg("Daily storyboard generated.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating storyboard.");
    } finally {
      setLoadingStoryboard(false);
    }
  }

  async function handleSave() {
    setErrorMsg(null);
    setStatusMsg(null);
    if (!onSaveSettings) {
      setStatusMsg("Settings ready in local state (connect onSaveSettings to persist to Supabase).");
      return;
    }

    setSaving(true);
    try {
      await onSaveSettings(settings);
      setStatusMsg("Workflow director settings saved.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save workflow settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold">AI Director Workflow Setup</h2>
          <p className="text-sm text-gray-500">
            Configure format, visual style, audio mode, reference anchors, and daily story brief.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateStoryboard}
            disabled={loadingStoryboard}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingStoryboard ? "Generating..." : "Preview Daily Storyboard"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Workflow"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      {statusMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMsg}
        </div>
      )}

      {/* Format, Style, Audio & Duration */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Content Format</label>
          <select
            value={settings.content_format}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                content_format: e.target.value as ContentFormat,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="video">Video (Reels / Shorts / Clips)</option>
            <option value="image">Single Image Post</option>
            <option value="carousel">Carousel Post</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Visual Style</label>
          <select
            value={settings.visual_style}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                visual_style: e.target.value as VisualStyle,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="brand">Brand & Product</option>
            <option value="cartoon">Cartoon / Illustrated</option>
            <option value="nature">Nature & Aesthetic</option>
            <option value="talking_character">Talking Character</option>
            <option value="storytime">Storytime / Love Story</option>
            <option value="educational">Educational / Tips</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Audio Mode</label>
          <select
            value={settings.audio_mode}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                audio_mode: e.target.value as AudioMode,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="voiceover_music">Voiceover + Music</option>
            <option value="talking_character">Talking Character Lip-Sync</option>
            <option value="music_only">Music Only</option>
            <option value="none">No Audio</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Duration (sec) & Ratio
          </label>
          <div className="flex gap-2">
            <select
              value={settings.duration_seconds}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  duration_seconds: Number(e.target.value),
                }))
              }
              className="w-1/2 rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={45}>45s</option>
              <option value={60}>60s</option>
            </select>
            <select
              value={settings.aspect_ratio}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  aspect_ratio: e.target.value as AspectRatio,
                }))
              }
              className="w-1/2 rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
              <option value="4:5">4:5</option>
              <option value="1:1">1:1</option>
            </select>
          </div>
        </div>
      </div>

      {/* Detailed Idea & Goal Brief */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            What You Want to Achieve (Goal)
          </label>
          <input
            type="text"
            value={settings.detailed_brief.goal}
            onChange={(e) => updateBrief("goal", e.target.value)}
            placeholder="e.g., Sell our cordless pet washer or grow a daily romance series"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Language & Voice Preset
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.voice_config.language}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  voice_config: { ...prev.voice_config, language: e.target.value },
                }))
              }
              placeholder="en"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={settings.voice_config.preset}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  voice_config: { ...prev.voice_config, preset: e.target.value },
                }))
              }
              placeholder="warm_clear"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Detailed Idea / Niche / Story World
          </label>
          <textarea
            rows={3}
            value={settings.detailed_brief.coreIdea}
            onChange={(e) => updateBrief("coreIdea", e.target.value)}
            placeholder="Describe what daily content should focus on, your product/character details, or your story premise..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Characters, Brand Identity & Tone
          </label>
          <input
            type="text"
            value={settings.detailed_brief.charactersAndTone}
            onChange={(e) => updateBrief("charactersAndTone", e.target.value)}
            placeholder="e.g., Playful golden retriever + warm candid creator tone"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Pacing, Hook Style & Call to Action
          </label>
          <input
            type="text"
            value={settings.detailed_brief.pacingAndCta}
            onChange={(e) => updateBrief("pacingAndCta", e.target.value)}
            placeholder="e.g., Fast 2s hook, emotional payoff, soft follow/comment CTA"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Story Arc Notes (Optional — for multi-part stories)
          </label>
          <input
            type="text"
            value={settings.detailed_brief.storyArcNotes || ""}
            onChange={(e) => updateBrief("storyArcNotes", e.target.value)}
            placeholder="e.g., Two strangers meeting on daily train commutes"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Avoid Rules (Optional)
          </label>
          <input
            type="text"
            value={settings.detailed_brief.avoidRules || ""}
            onChange={(e) => updateBrief("avoidRules", e.target.value)}
            placeholder="e.g., Avoid generic clichés, robotic voiceover, or harsh words"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Reference Assets (Product/Character Lock + Style Examples) */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Product / Character Anchors & Style Inspiration Links
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            value={assetKind}
            onChange={(e) => setAssetKind(e.target.value as ReferenceAsset["kind"])}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="product">Product Anchor</option>
            <option value="character">Character Anchor</option>
            <option value="style_example">Style Example (Vibe/Pacing)</option>
          </select>
          <input
            type="url"
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            placeholder="https://... image or video URL"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={assetLabel}
              onChange={(e) => setAssetLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddReferenceAsset}
              className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Add
            </button>
          </div>
        </div>

        {settings.reference_assets.length > 0 && (
          <ul className="space-y-1.5 pt-1 text-sm">
            {settings.reference_assets.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                <div className="truncate pr-3">
                  <span className="mr-2 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {item.kind}
                  </span>
                  <span className="font-medium">{item.label || item.url}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveReferenceAsset(item.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Auto-Publish Toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={settings.auto_publish}
          onChange={(e) =>
            setSettings((prev) => ({ ...prev, auto_publish: e.target.checked }))
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Automatically queue & publish generated daily posts on schedule
      </label>

      {/* Storyboard Preview */}
      {storyboard && (
        <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900">Generated Storyboard</h3>
            <span className="text-xs font-medium text-indigo-700">
              Hook: {storyboard.hook}
            </span>
          </div>

          <p className="text-sm text-gray-700">
            <strong className="font-semibold">Angle:</strong> {storyboard.angleSummary}
          </p>
          <p className="text-sm text-gray-700">
            <strong className="font-semibold">Visual Anchor:</strong>{" "}
            {storyboard.characterAndVisualAnchor}
          </p>

          {storyboard.voiceoverScript && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                Voiceover / Narration Script
              </div>
              <p className="whitespace-pre-line text-gray-800">{storyboard.voiceoverScript}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Scenes ({storyboard.scenes.length})
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {storyboard.scenes.map((sc) => (
                <div
                  key={sc.sceneNumber}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-700">
                    <span>
                      Scene {sc.sceneNumber} ({sc.startSec}s - {sc.endSec}s)
                    </span>
                    {sc.usesProductOrCharacterRef && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                        Ref Locked
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800">{sc.visualPrompt}</p>
                  <p className="text-xs text-gray-500">Camera/Motion: {sc.motionOrCameraNote}</p>
                  {sc.narrationOrOverlayText && (
                    <p className="text-xs text-gray-600">
                      Text/VO: {sc.narrationOrOverlayText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm space-y-1">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Social Caption & Hashtags
            </div>
            <p className="text-gray-800">{storyboard.caption}</p>
            <p className="text-xs font-medium text-indigo-600">
              {storyboard.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

type CreateMode = "image" | "reel";
type AspectChoice = "1:1" | "9:16" | "16:9" | "4:5";
type ReelDuration = "15" | "30";

type ReelScene = {
  scene: number;
  description: string;
  duration: string;
  generationPrompt?: string;
};

type GeneratedVideo = {
  scene: number;
  video: string;
  duration: string;
};

const ASPECT_OPTIONS: {
  id: AspectChoice;
  label: string;
  hint: string;
}[] = [
  { id: "1:1", label: "1:1 Square", hint: "Social feed & studio square" },
  { id: "9:16", label: "9:16 Reel", hint: "Vertical Reels & Shorts" },
  { id: "16:9", label: "16:9 Wide", hint: "Landscape & widescreen" },
  { id: "4:5", label: "4:5 Portrait", hint: "Tall portrait post" },
];

const QUICK_STARTERS = [
  {
    label: "Futuristic Product Shot",
    prompt:
      "Sleek matte-black wireless audio device resting on dark obsidian stone with warm rim lighting and soft bokeh.",
  },
  {
    label: "Cinematic Story Reel",
    prompt:
      "Scene 1: Moody sunrise over misty hills as camera glides forward. Scene 2: Close-up of glowing lantern and crisp atmospheric motion.",
  },
  {
    label: "Vibrant Brand Poster",
    prompt:
      "Bold geometric abstract glass waves in violet, magenta, and cyan with studio depth and clean composition.",
  },
];

export default function CreatePage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<CreateMode>("image");
  const [aspectRatio, setAspectRatio] = useState<AspectChoice>("1:1");
  const [reelDuration, setReelDuration] = useState<ReelDuration>("15");
  const [promptText, setPromptText] = useState("");
  const [overlayText, setOverlayText] = useState("");

  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(
    null
  );
  const [referenceFileName, setReferenceFileName] = useState<string | null>(
    null
  );

  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [currentSceneNum, setCurrentSceneNum] = useState<number | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>(
    []
  );
  const [error, setError] = useState("");
  const [statusNote, setStatusNote] = useState("");

  async function refreshCredits() {
    setLoadingCredits(true);
    try {
      const res = await fetch("/api/billing/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.credits === "number") {
          setCredits(data.credits);
        }
      }
    } catch {
      // Ignore transient credit fetch error
    } finally {
      setLoadingCredits(false);
    }
  }

  useEffect(() => {
    refreshCredits();
  }, []);

  async function deductOneCredit(reasonNote: string): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please sign in to generate and use credits.");
      return false;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      setError(profErr.message);
      return false;
    }

    const currentBal = typeof prof?.credits === "number" ? prof.credits : 0;
    if (currentBal < 1) {
      setError("Not enough credits remaining (0 credits).");
      setCredits(0);
      return false;
    }

    const nextBal = currentBal - 1;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ credits: nextBal })
      .eq("id", user.id);

    if (updErr) {
      setError(updErr.message);
      return false;
    }

    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      reason: "generation",
      delta: -1,
      balance_after: nextBal,
      note: reasonNote.slice(0, 180),
    });

    setCredits(nextBal);
    return true;
  }

  function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WEBP) as reference.");
      return;
    }
    setError("");
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setReferenceImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearReferenceImage() {
    setReferenceImageUrl(null);
    setReferenceFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function buildScenesForReel(text: string, duration: ReelDuration): ReelScene[] {
    const clean = text.trim();
    const parts = clean
      .split(/\n+|(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (duration === "30") {
      const s1 = parts[0] || `Opening hook: ${clean}`;
      const s2 = parts[1] || `Developing visual story: ${clean}`;
      const s3 = parts[2] || `Dynamic close-up and motion detail: ${clean}`;
      const s4 = parts[3] || `Strong visual payoff and finale: ${clean}`;
      return [
        { scene: 1, duration: "8 seconds", description: s1, generationPrompt: s1 },
        { scene: 2, duration: "8 seconds", description: s2, generationPrompt: s2 },
        { scene: 3, duration: "7 seconds", description: s3, generationPrompt: s3 },
        { scene: 4, duration: "7 seconds", description: s4, generationPrompt: s4 },
      ];
    }

    const s1 = parts[0] || `Opening scene: ${clean}`;
    const s2 = parts[1] || `Main action and motion: ${clean}`;
    return [
      { scene: 1, duration: "8 seconds", description: s1, generationPrompt: s1 },
      { scene: 2, duration: "7 seconds", description: s2, generationPrompt: s2 },
    ];
  }

  async function handleGenerate() {
    const trimmedPrompt = promptText.trim();
    if (!trimmedPrompt) {
      setError("Enter a script or prompt to generate.");
      return;
    }

    setError("");
    setStatusNote("");
    setGenerating(true);
    setCurrentSceneNum(null);

    if (mode === "image") {
      setGeneratedImage(null);
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aspectRatio,
            referenceImage: referenceImageUrl,
            plan: {
              title: trimmedPrompt.slice(0, 80),
              concept: trimmedPrompt,
              creativeIntent: trimmedPrompt,
              imageDirection: trimmedPrompt,
              visualStrategy: {
                mainSubject: trimmedPrompt,
                environment: "Studio / creative scene matching prompt",
                mood: "Vibrant, high-detail studio look",
                visualStyle: "High-detail digital art & photography",
                composition: `${aspectRatio} framing`,
              },
              textStrategy: {
                textRequired: Boolean(overlayText.trim()),
                requestedText: overlayText.trim(),
                placement: "bottom",
                style: "clean typography",
              },
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.image) {
          throw new Error(data?.error || "Image generation failed.");
        }

        setGeneratedImage(data.image);
        const charged = await deductOneCredit(`Create AI Image (${aspectRatio})`);
        setStatusNote(
          charged
            ? `Generated ${aspectRatio} image · 1 credit deducted.`
            : `Generated ${aspectRatio} image.`
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to generate image."
        );
      } finally {
        setGenerating(false);
      }
      return;
    }

    // Reel / Video generation
    setGeneratedVideos([]);
    const scenes = buildScenesForReel(trimmedPrompt, reelDuration);
    const planPayload = {
      originalRequest: trimmedPrompt,
      title: trimmedPrompt.slice(0, 80),
      concept: trimmedPrompt,
      creativeIntent: trimmedPrompt,
      visualStrategy: {
        mainSubject: trimmedPrompt,
        environment: "Cohesive multi-scene studio environment",
        mood: "Dynamic, cinematic",
        visualStyle: "High-detail motion & cinematography",
        composition: `${aspectRatio} framing`,
      },
      reelProduction: {
        required: true,
        duration: reelDuration,
        hook: scenes[0]?.description || trimmedPrompt,
        storyPremise: trimmedPrompt,
        scenes,
      },
      scenes,
    };

    try {
      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        setCurrentSceneNum(sc.scene);

        const res = await fetch("/api/generate-reel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: planPayload,
            scene: sc,
            reelDuration,
            aspectRatio,
            hasReferenceImage: Boolean(referenceImageUrl),
          }),
        });

        const data = await res.json();
        const videoUrl =
          data?.video?.url || data?.video?.uri || data?.videoUrl || null;

        if (!res.ok || !videoUrl) {
          throw new Error(
            data?.error || `Failed to generate scene ${sc.scene}.`
          );
        }

        await deductOneCredit(
          `Create AI Video Scene ${sc.scene} (${aspectRatio})`
        );

        setGeneratedVideos((prev) => [
          ...prev,
          {
            scene: sc.scene,
            video: videoUrl,
            duration: sc.duration,
          },
        ]);
      }

      setCurrentSceneNum(null);
      setStatusNote(
        `Generated ${scenes.length} video scene(s) in ${aspectRatio} · ${scenes.length} credit(s) deducted.`
      );
    } catch (err) {
      setCurrentSceneNum(null);
      setError(
        err instanceof Error ? err.message : "Unable to generate video."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <div className="w-full space-y-7 px-4 py-7 sm:px-6 lg:px-8">
        {/* TOP STUDIO BAR */}
        <section
          className="rounded-3xl border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(125deg, rgba(124,92,255,0.22) 0%, var(--card) 55%, rgba(236,72,153,0.18) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#C4B5FD]">
                ✦ On-Demand Gemini &amp; AI Studio
              </p>
              <h1 className="mt-1.5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Create AI Images &amp; Videos
              </h1>
              <p className="mt-1.5 text-sm font-medium text-neutral-300">
                Write a script or prompt, attach an optional reference image, pick
                your size, and generate immediately.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-extrabold text-emerald-300">
                Credits:{" "}
                <span>
                  {loadingCredits ? "..." : credits !== null ? credits : 0}
                </span>
              </div>
              <span className="rounded-2xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/20 px-4 py-2.5 text-xs font-extrabold text-[#C4B5FD]">
                Cost: 1 Credit / {mode === "image" ? "Image" : "Scene Clip"}
              </span>
            </div>
          </div>

          {/* QUICK STARTERS */}
          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK_STARTERS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={generating}
                onClick={() => {
                  setPromptText(item.prompt);
                  setError("");
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-neutral-200 transition hover:border-[#7C5CFF] hover:bg-[#7C5CFF]/20 hover:text-white disabled:opacity-50"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* CONTROLS: MODE, SIZE & REEL DURATION */}
        <section className="grid gap-5 lg:grid-cols-12">
          <div
            className="space-y-6 rounded-3xl border p-6 lg:col-span-8"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Mode Switch */}
            <div>
              <label className="block text-sm font-extrabold text-white">
                1. Output Type
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setMode("image")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    mode === "image"
                      ? "border-[#7C5CFF] bg-[#7C5CFF]/15 text-white"
                      : "border-white/15 bg-[#121218] text-neutral-300 hover:border-white/30"
                  }`}
                >
                  <div className="text-base font-black">✦ AI Image</div>
                  <p className="mt-1 text-xs text-neutral-300">
                    Instant high-resolution visual in your chosen aspect ratio.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setMode("reel")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    mode === "reel"
                      ? "border-[#EC4899] bg-[#EC4899]/15 text-white"
                      : "border-white/15 bg-[#121218] text-neutral-300 hover:border-white/30"
                  }`}
                >
                  <div className="text-base font-black">▶ AI Video / Reel</div>
                  <p className="mt-1 text-xs text-neutral-300">
                    Generate multi-scene video clips from your script.
                  </p>
                </button>
              </div>
            </div>

            {/* Aspect Ratio / Size */}
            <div>
              <label className="block text-sm font-extrabold text-white">
                2. Size / Aspect Ratio
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ASPECT_OPTIONS.map((opt) => {
                  const active = aspectRatio === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={generating}
                      onClick={() => setAspectRatio(opt.id)}
                      className={`rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
                          : "border-white/15 bg-[#121218] text-neutral-200 hover:border-white/35"
                      }`}
                    >
                      <div className="text-sm font-black">{opt.label}</div>
                      <div
                        className={`mt-0.5 text-[11px] ${
                          active ? "text-white/90" : "text-neutral-400"
                        }`}
                      >
                        {opt.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "reel" && (
              <div>
                <label className="block text-sm font-extrabold text-white">
                  Reel Target Length
                </label>
                <div className="mt-3 flex gap-3">
                  {(["15", "30"] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      disabled={generating}
                      onClick={() => setReelDuration(dur)}
                      className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition ${
                        reelDuration === dur
                          ? "border-[#EC4899] bg-[#EC4899] text-white"
                          : "border-white/15 bg-[#121218] text-neutral-300"
                      }`}
                    >
                      {dur}s Reel ({dur === "15" ? "2 clips" : "4 clips"})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Script / Prompt */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-extrabold text-white">
                  3. Script or Prompt
                </label>
                <span className="text-xs text-neutral-400">
                  {promptText.length} chars
                </span>
              </div>
              <textarea
                rows={5}
                disabled={generating}
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Describe what you want to see—scene details, lighting, camera movement, or script..."
                className="mt-2.5 w-full rounded-2xl border border-white/15 bg-[#111116] p-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>

            {mode === "image" && (
              <div>
                <label className="block text-sm font-extrabold text-white">
                  Optional Text on Image
                </label>
                <input
                  type="text"
                  disabled={generating}
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder="Leave blank for clean artwork without text"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#111116] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200">
                {error}
              </div>
            )}

            {statusNote && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200">
                {statusNote}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-neutral-400">
                Does not modify workflows, schedule slots, or calendar queues.
              </span>

              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="rounded-2xl bg-[#7C5CFF] px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-[#6A48F5] disabled:opacity-50"
              >
                {generating
                  ? mode === "reel" && currentSceneNum
                    ? `Generating Scene ${currentSceneNum}...`
                    : "Generating..."
                  : mode === "image"
                  ? "✦ Generate Image (1 Credit)"
                  : "▶ Generate Video (1 Credit / Clip)"}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: REFERENCE IMAGE */}
          <div
            className="flex flex-col justify-between rounded-3xl border p-6 lg:col-span-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-base font-extrabold text-white">
                Reference Image (Optional)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                Attach a photo or design reference so the AI keeps style,
                product look, or subject direction aligned.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleReferenceFileChange}
                className="hidden"
              />

              <div
                onClick={() => !generating && fileInputRef.current?.click()}
                className="mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[#111116] p-4 text-center transition hover:border-[#7C5CFF]"
              >
                {referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={referenceImageUrl}
                    alt={referenceFileName || "Reference preview"}
                    className="max-h-60 w-full rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C5CFF]/20 text-xl text-[#C4B5FD]">
                      +
                    </span>
                    <p className="mt-3 text-sm font-bold text-white">
                      Click to upload reference image
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      PNG, JPG, WEBP
                    </p>
                  </>
                )}
              </div>

              {referenceFileName && (
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-neutral-300">
                    {referenceFileName}
                  </span>
                  <button
                    type="button"
                    onClick={clearReferenceImage}
                    className="font-bold text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* OUTPUT PREVIEW */}
        {generatedImage && (
          <section
            className="rounded-3xl border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">
                Generated Image ({aspectRatio})
              </h2>
              <a
                href={generatedImage}
                download={`postoll-${aspectRatio.replace(":", "x")}.png`}
                className="rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-black hover:bg-neutral-200"
              >
                Download PNG
              </a>
            </div>
            <div className="flex justify-center rounded-2xl bg-black/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImage}
                alt="Generated AI image"
                className="max-h-[640px] rounded-xl object-contain"
              />
            </div>
          </section>
        )}

        {generatedVideos.length > 0 && (
          <section
            className="space-y-4 rounded-3xl border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-xl font-black text-white">
              Generated Video Clips ({aspectRatio})
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              {generatedVideos.map((vid) => (
                <div
                  key={vid.scene}
                  className="overflow-hidden rounded-2xl border border-white/15 bg-[#111116]"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs font-bold">
                    <span>Scene {vid.scene}</span>
                    <span className="text-neutral-400">{vid.duration}</span>
                  </div>
                  <video
                    src={vid.video}
                    controls
                    playsInline
                    className="max-h-[520px] w-full bg-black object-contain"
                  />
                  <div className="flex justify-end px-4 py-3">
                    <a
                      href={vid.video}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                    >
                      Open Video
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

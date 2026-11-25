"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../AppShell";

type ReelDuration = "15" | "30";

type ContentType = "post" | "reel";

type ReelScene = {
  scene: number;
  description: string;
  duration: string;
};

type DetailedReelScene = ReelScene & {
  scenePurpose: string;
  storyBeat: string;
  generationUnit: string;
  shotType: string;
  camera: string;
  cameraMovement: string;
  composition: string;
  environment: string;
  characters: string;
  characterAction: string;
  importantObjects: string;
  lighting: string;
  mood: string;
  audio: string;
  musicMoment: string;
  soundEffects: string[];
  dialogue: string;
  continuityFromPrevious: string;
  continuityToNext: string;
  startState: string;
  endState: string;
  transition: string;
  visualPriority: string;
  generationPrompt: string;
  negativePrompt: string;
};

type ReelProduction = {
  required: boolean;
  duration: "15" | "30" | string;
  targetGenerationResolution: string;
  generationUnitDuration: string;
  generationStrategy: string;
  hook: string;
  storyPremise: string;
  emotionalProgression: string;
  beginning: string;
  middle: string;
  ending: string;
  finalPayoff: string;
  characterBible: Array<Record<string, unknown>>;
  environmentBible: {
    primaryEnvironment: string;
    stableElements: string[];
    variableElements: string[];
    intentionalChanges: string[];
  };
  objectBible: Array<Record<string, unknown>>;
  cinematographyBible: {
    visualStyle: string;
    realism: string;
    lensCharacter: string;
    cameraLanguage: string;
    cameraMovement: string;
    shotLanguage: string;
    depthOfField: string;
    lightingLanguage: string;
    colorGrade: string;
    motionLanguage: string;
  };
  audioBible: {
    musicStyle: string;
    instrumentation: string;
    tempo: string;
    emotionalTone: string;
    ambientSound: string;
    soundEffects: string[];
    dialogueStyle: string;
    musicProgression: string;
    audioContinuity: string;
  };
  continuityRules: {
    character: string[];
    environment: string[];
    objects: string[];
    lighting: string[];
    time: string[];
    camera: string[];
    action: string[];
    emotion: string[];
    audio: string[];
    color: string[];
    allowedChanges: string[];
  };
  referenceAssets: string[];
  scenes: DetailedReelScene[];
};

type ContentPlan = {
  originalRequest: string;
  title: string;
  concept: string;
  creativeIntent: string;
  caption: string;
  hashtags: string[];

  visualStrategy: {
    subjectType: string;
    mainSubject: string;
    secondarySubjects: string[];
    environment: string;
    action: string;
    mood: string;
    visualStyle: string;
    lighting: string;
    composition: string;
    camera: string;
    colorDirection: string;
  };

  textStrategy: {
    textRequired: boolean;
    reason: string;
    requestedText: string;
    placement: string;
    style: string;
  };

  brandingStrategy: {
    brandMentioned: boolean;
    brandName: string;
    logoRequired: boolean;
  };

  imageDirection: string;
  avoid: string[];

  reelProduction?: ReelProduction;

  scenes: ReelScene[];
};

type GeneratedVideo = {
  scene: number;
  video: string;
};

const QUICK_PROMPT_IDEAS = [
  {
    label: "Golden Hour Product Reel",
    prompt:
      "Create a dynamic vertical reel showcasing a sleek product on a sunlit studio table with crisp macro camera moves and upbeat modern energy.",
  },
  {
    label: "Cafe & Lifestyle Post",
    prompt:
      "Create an inviting social media post for an artisan coffee bar with warm morning light, pour-over motion, and engaging caption ideas.",
  },
  {
    label: "Tech & Workflow Spotlight",
    prompt:
      "Create a clean, futuristic visual post and short reel highlighting fast AI automation turning one idea into multi-platform content.",
  },
];

export default function CreatePage() {
  const router = useRouter();

  const [postSelected, setPostSelected] = useState(true);
  const [reelSelected, setReelSelected] = useState(false);

  const [reelDuration, setReelDuration] = useState<ReelDuration>("15");

  const [idea, setIdea] = useState("");

  const [loading, setLoading] = useState(false);

  const [generatingImage, setGeneratingImage] = useState(false);

  const [generatingReel, setGeneratingReel] = useState(false);

  const [currentReelScene, setCurrentReelScene] = useState<number | null>(
    null
  );

  const [savingContent, setSavingContent] = useState(false);

  const [plan, setPlan] = useState<ContentPlan | null>(null);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>(
    []
  );

  const [error, setError] = useState("");

  const [imageError, setImageError] = useState("");

  const [reelError, setReelError] = useState("");

  const [reelScriptApproved, setReelScriptApproved] = useState(false);

  const generatedPlanRef = useRef<HTMLDivElement>(null);

  const generatedImageRef = useRef<HTMLDivElement>(null);

  const generatedReelRef = useRef<HTMLDivElement>(null);

  const isBusy =
    loading || generatingImage || generatingReel || savingContent;

  function hasSelection() {
    return postSelected || reelSelected;
  }

  function getSelectedContentTypes(): ContentType[] {
    const contentTypes: ContentType[] = [];

    if (postSelected) {
      contentTypes.push("post");
    }

    if (reelSelected) {
      contentTypes.push("reel");
    }

    return contentTypes;
  }

  async function handleContinue() {
    if (!idea.trim()) {
      setError("Tell Postoll what you want to create first.");
      return;
    }

    if (!hasSelection()) {
      setError("Choose at least one content type.");
      return;
    }

    setError("");
    setImageError("");
    setReelError("");

    setLoading(true);

    setPlan(null);
    setGeneratedImage(null);
    setGeneratedVideos([]);
    setReelScriptApproved(false);

    try {
      const contentTypes = getSelectedContentTypes();

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: idea.trim(),
          contentTypes,
          reelDuration: reelSelected ? reelDuration : null,
          type: reelSelected && !postSelected ? "reel" : "post",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      if (!data.plan) {
        throw new Error("Postoll did not return a content plan.");
      }

      setPlan(data.plan);

      setTimeout(() => {
        generatedPlanRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate your content plan."
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    if (!plan) {
      return;
    }

    if (!postSelected) {
      setImageError(
        "Image generation is available when Social Post is selected."
      );
      return;
    }

    setGeneratingImage(true);
    setImageError("");
    setGeneratedImage(null);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate the creative.");
      }

      if (!data.image) {
        throw new Error("The image generator did not return an image.");
      }

      setGeneratedImage(data.image);

      setTimeout(() => {
        generatedImageRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 200);
    } catch (err) {
      setImageError(
        err instanceof Error
          ? err.message
          : "Unable to generate the creative."
      );
    } finally {
      setGeneratingImage(false);
    }
  }

  function extractVideoFromResponse(data: unknown): string | null {
    if (!data || typeof data !== "object") {
      return null;
    }
    const obj = data as Record<string, unknown>;

    if (typeof obj.video === "string") {
      return obj.video;
    }

    if (typeof obj.videoUrl === "string") {
      return obj.videoUrl;
    }

    if (typeof obj.url === "string") {
      return obj.url;
    }

    if (
      obj.video &&
      typeof obj.video === "object" &&
      typeof (obj.video as Record<string, unknown>).url === "string"
    ) {
      return (obj.video as Record<string, unknown>).url as string;
    }

    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      if (typeof nested.video === "string") return nested.video;
      if (typeof nested.videoUrl === "string") return nested.videoUrl;
      if (typeof nested.url === "string") return nested.url;
    }

    return null;
  }

  function updatePlan(updater: (current: ContentPlan) => ContentPlan) {
    setPlan((current) => (current ? updater(current) : current));
    setReelScriptApproved(false);
  }

  function updateReelProduction(
    updater: (current: ReelProduction) => ReelProduction
  ) {
    updatePlan((current) => {
      if (!current.reelProduction) {
        return current;
      }

      return {
        ...current,
        reelProduction: updater(current.reelProduction),
      };
    });
  }

  function updateDetailedScene(
    sceneNumber: number,
    field: keyof DetailedReelScene,
    value: string | string[]
  ) {
    updateReelProduction((production) => ({
      ...production,
      scenes: production.scenes.map((scene) =>
        scene.scene === sceneNumber
          ? {
              ...scene,
              [field]: value,
            }
          : scene
      ),
    }));
  }

  function approveReelScript() {
    if (!plan?.reelProduction?.scenes?.length) {
      setReelError(
        "Postoll did not return detailed reel scenes. Generate the plan again before approving the script."
      );
      return;
    }

    setReelError("");
    setReelScriptApproved(true);

    setTimeout(() => {
      generatedPlanRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 100);
  }

  async function generateReel() {
    if (!plan) {
      return;
    }

    if (!reelScriptApproved) {
      setReelError("Approve the detailed reel script before generating video.");
      return;
    }

    if (!reelSelected) {
      setReelError("Select Short-form Reel first.");
      return;
    }

    if (!plan.scenes || plan.scenes.length === 0) {
      setReelError("No reel scenes were found in the creative plan.");
      return;
    }

    setGeneratingReel(true);
    setCurrentReelScene(null);
    setReelError("");

    setGeneratedVideos([]);

    try {
      const videos: GeneratedVideo[] = [];

      for (let index = 0; index < plan.scenes.length; index++) {
        const scene = plan.scenes[index];

        setCurrentReelScene(scene.scene);

        const response = await fetch("/api/generate-reel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idea: idea.trim(),
            plan,
            scene,
            sceneNumber: scene.scene,
            reelDuration,
            totalScenes: plan.scenes.length,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || `Unable to generate scene ${scene.scene}.`
          );
        }

        const video = extractVideoFromResponse(data);

        if (!video) {
          throw new Error(
            `Scene ${scene.scene} was generated, but the API did not return a video.`
          );
        }

        const generatedVideo = {
          scene: scene.scene,
          video,
        };

        videos.push(generatedVideo);

        setGeneratedVideos((current) => [...current, generatedVideo]);
      }

      setCurrentReelScene(null);

      setTimeout(() => {
        generatedReelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 200);
    } catch (err) {
      setCurrentReelScene(null);

      setReelError(
        err instanceof Error
          ? err.message
          : "Unable to generate the reel."
      );
    } finally {
      setGeneratingReel(false);
    }
  }

  async function approveCreative() {
    if (!plan || !generatedImage) {
      return;
    }

    setSavingContent(true);
    setImageError("");

    try {
      const response = await fetch("/api/save-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "post",
          idea: idea.trim(),
          plan,
          image: generatedImage,
          contentTypes: getSelectedContentTypes(),
          reelDuration: reelSelected ? reelDuration : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save the creative.");
      }

      console.log("Creative saved successfully:", data.content);

      router.push("/content");
    } catch (err) {
      console.error("Save creative error:", err);

      setImageError(
        err instanceof Error
          ? err.message
          : "Unable to save the creative."
      );

      setSavingContent(false);
    }
  }

  function handleEditPlan() {
    setPlan(null);
    setGeneratedImage(null);
    setGeneratedVideos([]);
    setImageError("");
    setReelError("");
    setReelScriptApproved(false);

    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 50);
  }

  function handleBackToPlan() {
    setGeneratedImage(null);
    setImageError("");

    setTimeout(() => {
      generatedPlanRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function togglePost() {
    if (isBusy) {
      return;
    }

    setPostSelected((current) => !current);
    setError("");
  }

  function toggleReel() {
    if (isBusy) {
      return;
    }

    setReelSelected((current) => !current);
    setError("");
  }

  function changeReelDuration(duration: ReelDuration) {
    if (isBusy) {
      return;
    }

    setReelDuration(duration);
    setError("");
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
        {/* COLORFUL STUDIO CREATION HEADER */}
        <div
          className="mb-10 rounded-3xl border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,92,255,0.2) 0%, var(--card) 52%, rgba(236,72,153,0.16) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/35 bg-[#7C5CFF]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#C4B5FD]">
            <span>✦</span>
            <span>AI Content &amp; Reel Studio</span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            Create something{" "}
            <span className="bg-gradient-to-r from-[#C4B5FD] via-[#F472B6] to-[#FBBF24] bg-clip-text text-transparent">
              extraordinary.
            </span>
          </h1>

          <p
            className="mt-3 max-w-3xl text-sm leading-7 sm:text-base"
            style={{ color: "var(--muted)" }}
          >
            Tell Postoll what you want to create. We&apos;ll shape your idea
            into a structured visual plan, storyboard, and multi-platform post or
            reel.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {QUICK_PROMPT_IDEAS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setIdea(sample.prompt);
                  if (error) setError("");
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-[#7C5CFF] hover:bg-[#7C5CFF]/15 hover:text-white disabled:opacity-50"
              >
                + {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT TYPE */}
        <div className="mb-10">
          <h2 className="text-lg font-bold">What do you want to create?</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Choose a post, a reel, or both.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {/* POST */}
            <button
              type="button"
              onClick={togglePost}
              disabled={isBusy}
              className="relative rounded-2xl border p-6 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 sm:p-7"
              style={{
                background: postSelected
                  ? "rgba(124, 92, 255, 0.12)"
                  : "var(--card)",
                borderColor: postSelected ? "#7C5CFF" : "var(--border)",
              }}
            >
              {postSelected && (
                <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CFF] text-sm font-bold text-white">
                  ✓
                </div>
              )}

              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-[#C4B5FD]"
                style={{ background: "rgba(124, 92, 255, 0.18)" }}
              >
                ✦
              </div>

              <h3 className="text-xl font-bold">Social Post</h3>
              <p
                className="mt-2.5 max-w-xl text-sm leading-7"
                style={{ color: "var(--muted)" }}
              >
                Create a visual social post based on whatever idea, script,
                product, story or concept you provide.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["Image", "Caption", "Hashtags"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--muted)",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </button>

            {/* REEL */}
            <button
              type="button"
              onClick={toggleReel}
              disabled={isBusy}
              className="relative rounded-2xl border p-6 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 sm:p-7"
              style={{
                background: reelSelected
                  ? "rgba(236, 72, 153, 0.12)"
                  : "var(--card)",
                borderColor: reelSelected ? "#EC4899" : "var(--border)",
              }}
            >
              {reelSelected && (
                <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#EC4899] text-sm font-bold text-white">
                  ✓
                </div>
              )}

              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-[#F9A8D4]"
                style={{ background: "rgba(236, 72, 153, 0.18)" }}
              >
                ▶
              </div>

              <h3 className="text-xl font-bold">Short-form Reel</h3>
              <p
                className="mt-2.5 max-w-xl text-sm leading-7"
                style={{ color: "var(--muted)" }}
              >
                Turn your idea or script into a structured short-form video with
                scenes, visuals and a complete creative direction.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {["Script", "Scenes", "Video"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--muted)",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </button>
          </div>

          {/* REEL DURATION */}
          {reelSelected && (
            <div
              className="mt-5 rounded-2xl border p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <h3 className="text-base font-bold">Reel duration</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Choose one reel duration.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => changeReelDuration("15")}
                  disabled={isBusy}
                  className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    background:
                      reelDuration === "15"
                        ? "rgba(124, 92, 255, 0.12)"
                        : "transparent",
                    borderColor:
                      reelDuration === "15" ? "#7C5CFF" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">15-second Reel</p>
                      <p
                        className="mt-1 text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        Short, fast and engaging.
                      </p>
                    </div>

                    {reelDuration === "15" && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C5CFF] text-sm text-white">
                        ✓
                      </div>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => changeReelDuration("30")}
                  disabled={isBusy}
                  className="rounded-xl border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    background:
                      reelDuration === "30"
                        ? "rgba(124, 92, 255, 0.12)"
                        : "transparent",
                    borderColor:
                      reelDuration === "30" ? "#7C5CFF" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">30-second Reel</p>
                      <p
                        className="mt-1 text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        More time for story and detail.
                      </p>
                    </div>

                    {reelDuration === "30" && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C5CFF] text-sm text-white">
                        ✓
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* IDEA */}
        <div>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold">Describe your idea</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Give Postoll anything — an idea, script, product, story,
                campaign or creative brief.
              </p>
            </div>

            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {idea.length} / 1000
            </span>
          </div>

          <div
            className="mt-5 rounded-2xl border p-5"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <textarea
              value={idea}
              onChange={(e) => {
                if (e.target.value.length <= 1000) {
                  setIdea(e.target.value);
                }

                if (error) {
                  setError("");
                }
              }}
              placeholder={
                postSelected && reelSelected
                  ? "Example: Create content for my new coffee shop. I want a social post and a short reel showing the coffee-making experience..."
                  : postSelected
                  ? "Example: Create an Instagram post showing a luxury black sports car driving through a mountain road at sunset..."
                  : "Example: A young woman receives a message from her father saying 'Come home.' She smiles, picks up her bag and boards the train..."
              }
              className="min-h-44 w-full resize-none bg-transparent text-base outline-none placeholder:text-gray-500 sm:text-lg"
            />

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div
              className="mt-5 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Postoll will understand your request and create a dynamic
                creative direction.
              </p>

              <button
                type="button"
                onClick={handleContinue}
                disabled={isBusy}
                className="rounded-xl bg-[#7C5CFF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Understanding..." : "✦ Continue"}
              </button>
            </div>
          </div>
        </div>

        {/* GENERATED PLAN */}
        {plan && (
          <div ref={generatedPlanRef} className="mt-12 scroll-mt-8">
            <div className="mb-5">
              <p className="text-sm font-bold text-[#C4B5FD]">
                ✦ Generated by Postoll
              </p>
              <h2 className="mt-1 text-2xl font-bold">Your creative plan</h2>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Postoll has analyzed your request and created a visual
                direction.
              </p>
            </div>

            <div
              className="rounded-2xl border p-6 shadow-sm"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <h3 className="text-xl font-bold">{plan.title}</h3>

              {plan.creativeIntent && (
                <div className="mt-6">
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Creative intent
                  </p>
                  <p className="mt-2 leading-7">{plan.creativeIntent}</p>
                </div>
              )}

              <div className="mt-6">
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                  Concept
                </p>
                <p className="mt-2 leading-7">{plan.concept}</p>
              </div>

              {plan.visualStrategy && (
                <div className="mt-8">
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Visual direction
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      ["Main subject", plan.visualStrategy.mainSubject],
                      ["Environment", plan.visualStrategy.environment],
                      ["Mood", plan.visualStrategy.mood],
                      ["Visual style", plan.visualStrategy.visualStyle],
                      ["Action", plan.visualStrategy.action],
                      ["Lighting", plan.visualStrategy.lighting],
                      ["Composition", plan.visualStrategy.composition],
                      ["Camera", plan.visualStrategy.camera],
                      ["Color", plan.visualStrategy.colorDirection],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border p-4"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                          {label}
                        </p>
                        <p className="mt-2 text-sm">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {plan.textStrategy && (
                <div className="mt-8">
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Text decision
                  </p>

                  <div
                    className="mt-3 rounded-xl border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        plan.textStrategy.textRequired
                          ? "bg-purple-500/15 text-purple-300"
                          : "bg-gray-500/10"
                      }`}
                    >
                      {plan.textStrategy.textRequired
                        ? "Text required"
                        : "Visual only"}
                    </span>

                    {plan.textStrategy.requestedText && (
                      <p className="mt-3 text-sm">
                        <span className="font-medium">Requested text:</span>{" "}
                        {plan.textStrategy.requestedText}
                      </p>
                    )}

                    <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                      {plan.textStrategy.reason}
                    </p>
                  </div>
                </div>
              )}

              {plan.brandingStrategy?.brandMentioned && (
                <div className="mt-8">
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Branding
                  </p>

                  <div
                    className="mt-3 rounded-xl border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="text-sm">
                      Brand: <strong>{plan.brandingStrategy.brandName}</strong>
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                      Logo required: {plan.brandingStrategy.logoRequired ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              )}

              {/* DETAILED REEL SCRIPT / STORYBOARD */}
              {reelSelected && plan.reelProduction && (
                <div
                  className="mt-10 rounded-2xl border p-6 md:p-8"
                  style={{
                    borderColor: "var(--border)",
                    background: "rgba(124, 92, 255, 0.05)",
                  }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#C4B5FD]">
                        ✦ Reel production script
                      </p>
                      <h3 className="mt-1 text-2xl font-bold">
                        Detailed script, continuity &amp; storyboard
                      </h3>
                      <p
                        className="mt-2 max-w-3xl text-sm leading-6"
                        style={{ color: "var(--muted)" }}
                      >
                        Review and edit the complete production plan before
                        Postoll generates any video. Scene-to-scene continuity,
                        camera direction, action, audio and generation prompts
                        are kept together.
                      </p>
                    </div>

                    <span
                      className="inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-bold"
                      style={{
                        borderColor: reelScriptApproved
                          ? "rgba(34,197,94,.4)"
                          : "var(--border)",
                        color: reelScriptApproved ? "#4ade80" : "var(--muted)",
                      }}
                    >
                      {reelScriptApproved
                        ? "✓ Script approved"
                        : "Approval required"}
                    </span>
                  </div>

                  {/* STORY ARC */}
                  <div className="mt-8">
                    <p className="text-sm font-semibold">Story arc</p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {[
                        ["Hook", "hook"],
                        ["Story premise", "storyPremise"],
                        ["Emotional progression", "emotionalProgression"],
                        ["Beginning", "beginning"],
                        ["Middle", "middle"],
                        ["Ending", "ending"],
                        ["Final visual payoff", "finalPayoff"],
                        ["Generation strategy", "generationStrategy"],
                      ].map(([label, field]) => (
                        <label key={field} className="block">
                          <span
                            className="text-xs font-medium uppercase tracking-wide"
                            style={{ color: "var(--muted)" }}
                          >
                            {label}
                          </span>
                          <textarea
                            value={
                              (plan.reelProduction?.[
                                field as keyof ReelProduction
                              ] as string) ?? ""
                            }
                            onChange={(event) =>
                              updateReelProduction((production) => ({
                                ...production,
                                [field]: event.target.value,
                              }))
                            }
                            rows={3}
                            className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                            style={{ borderColor: "var(--border)" }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* CONTINUITY BIBLES */}
                  <div className="mt-10">
                    <p className="text-sm font-semibold">
                      Continuity &amp; production bible
                    </p>

                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <p className="font-semibold">Characters</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          Identity, appearance, clothing, personality and
                          movement must stay coherent between scenes.
                        </p>

                        {plan.reelProduction.characterBible.length === 0 ? (
                          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                            No character bible was returned.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {plan.reelProduction.characterBible.map(
                              (character, index) => (
                                <div
                                  key={index}
                                  className="rounded-lg border p-3"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  {Object.entries(character).map(
                                    ([key, value]) => (
                                      <div key={key} className="mb-2 last:mb-0">
                                        <p className="text-xs font-medium uppercase opacity-60">
                                          {key}
                                        </p>
                                        <p className="mt-1 text-sm">
                                          {Array.isArray(value)
                                            ? value.join(", ")
                                            : String(value ?? "")}
                                        </p>
                                      </div>
                                    )
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        className="rounded-xl border p-4"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <p className="font-semibold">Environment</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                          Stable and naturally changing environmental details.
                        </p>

                        <label className="mt-3 block">
                          <span className="text-xs uppercase opacity-60">
                            Primary environment
                          </span>
                          <textarea
                            value={
                              plan.reelProduction.environmentBible.primaryEnvironment
                            }
                            onChange={(event) =>
                              updateReelProduction((production) => ({
                                ...production,
                                environmentBible: {
                                  ...production.environmentBible,
                                  primaryEnvironment: event.target.value,
                                },
                              }))
                            }
                            rows={3}
                            className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                            style={{ borderColor: "var(--border)" }}
                          />
                        </label>

                        {[
                          ["Stable elements", "stableElements"],
                          ["Naturally variable", "variableElements"],
                          ["Intentional changes", "intentionalChanges"],
                        ].map(([label, field]) => (
                          <label key={field} className="mt-3 block">
                            <span className="text-xs uppercase opacity-60">
                              {label}
                            </span>
                            <textarea
                              value={
                                plan.reelProduction!.environmentBible[
                                  field as
                                    | "stableElements"
                                    | "variableElements"
                                    | "intentionalChanges"
                                ].join("\n")
                              }
                              onChange={(event) =>
                                updateReelProduction((production) => ({
                                  ...production,
                                  environmentBible: {
                                    ...production.environmentBible,
                                    [field]: event.target.value
                                      .split("\n")
                                      .map((item) => item.trim())
                                      .filter(Boolean),
                                  },
                                }))
                              }
                              rows={3}
                              className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                              style={{ borderColor: "var(--border)" }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-xl border p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <p className="font-semibold">Cinematography &amp; audio</p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {Object.entries(plan.reelProduction.cinematographyBible).map(
                          ([field, value]) => (
                            <label key={field} className="block">
                              <span className="text-xs uppercase opacity-60">
                                {field.replace(/([A-Z])/g, " $1")}
                              </span>
                              <textarea
                                value={String(value ?? "")}
                                onChange={(event) =>
                                  updateReelProduction((production) => ({
                                    ...production,
                                    cinematographyBible: {
                                      ...production.cinematographyBible,
                                      [field]: event.target.value,
                                    },
                                  }))
                                }
                                rows={2}
                                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--border)" }}
                              />
                            </label>
                          )
                        )}

                        {Object.entries(plan.reelProduction.audioBible).map(
                          ([field, value]) => (
                            <label key={field} className="block">
                              <span className="text-xs uppercase opacity-60">
                                {field.replace(/([A-Z])/g, " $1")}
                              </span>
                              <textarea
                                value={
                                  Array.isArray(value)
                                    ? value.join("\n")
                                    : String(value ?? "")
                                }
                                onChange={(event) =>
                                  updateReelProduction((production) => ({
                                    ...production,
                                    audioBible: {
                                      ...production.audioBible,
                                      [field]: Array.isArray(value)
                                        ? event.target.value
                                            .split("\n")
                                            .map((item) => item.trim())
                                            .filter(Boolean)
                                        : event.target.value,
                                    },
                                  }))
                                }
                                rows={2}
                                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--border)" }}
                              />
                            </label>
                          )
                        )}
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-xl border p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <p className="font-semibold">Continuity rules</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {Object.entries(plan.reelProduction.continuityRules).map(
                          ([field, values]) => (
                            <label key={field} className="block">
                              <span className="text-xs uppercase opacity-60">
                                {field}
                              </span>
                              <textarea
                                value={values.join("\n")}
                                onChange={(event) =>
                                  updateReelProduction((production) => ({
                                    ...production,
                                    continuityRules: {
                                      ...production.continuityRules,
                                      [field]: event.target.value
                                        .split("\n")
                                        .map((item) => item.trim())
                                        .filter(Boolean),
                                    },
                                  }))
                                }
                                rows={3}
                                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--border)" }}
                              />
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SCENE-BY-SCENE EDITOR */}
                  <div className="mt-10">
                    <p className="text-sm font-semibold">
                      Scene-by-scene script &amp; generation instructions
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                      Each scene has a start state and end state so the next
                      clip can continue from the previous clip instead of
                      becoming a disconnected video.
                    </p>

                    <div className="mt-4 space-y-5">
                      {plan.reelProduction.scenes.map((scene) => (
                        <div
                          key={scene.scene}
                          className="rounded-2xl border p-5"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-lg font-semibold">
                                Scene {scene.scene}
                              </h4>
                              <p className="text-xs" style={{ color: "var(--muted)" }}>
                                {scene.duration}
                              </p>
                            </div>
                            <span className="rounded-full border px-3 py-1 text-xs">
                              Editable
                            </span>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            {[
                              ["scenePurpose", "Scene purpose"],
                              ["storyBeat", "Story beat"],
                              ["description", "Description"],
                              ["generationUnit", "Generation unit"],
                              ["shotType", "Shot type"],
                              ["camera", "Camera"],
                              ["cameraMovement", "Camera movement"],
                              ["composition", "Composition"],
                              ["environment", "Environment"],
                              ["characters", "Characters"],
                              ["characterAction", "Character action"],
                              ["importantObjects", "Important objects"],
                              ["lighting", "Lighting"],
                              ["mood", "Mood"],
                              ["audio", "Audio"],
                              ["musicMoment", "Music moment"],
                              ["dialogue", "Dialogue"],
                              ["continuityFromPrevious", "Continuity from previous"],
                              ["continuityToNext", "Continuity to next"],
                              ["startState", "Start state"],
                              ["endState", "End state"],
                              ["transition", "Transition"],
                              ["visualPriority", "Visual priority"],
                              ["generationPrompt", "Generation prompt"],
                              ["negativePrompt", "Negative prompt"],
                            ].map(([field, label]) => (
                              <label
                                key={field}
                                className={
                                  field === "generationPrompt" ||
                                  field === "negativePrompt" ||
                                  field === "description"
                                    ? "block md:col-span-2"
                                    : "block"
                                }
                              >
                                <span
                                  className="text-xs font-medium uppercase tracking-wide"
                                  style={{ color: "var(--muted)" }}
                                >
                                  {label}
                                </span>
                                <textarea
                                  value={String(
                                    scene[field as keyof DetailedReelScene] ?? ""
                                  )}
                                  onChange={(event) =>
                                    updateDetailedScene(
                                      scene.scene,
                                      field as keyof DetailedReelScene,
                                      event.target.value
                                    )
                                  }
                                  rows={
                                    field === "generationPrompt" ||
                                    field === "negativePrompt" ||
                                    field === "description"
                                      ? 5
                                      : 3
                                  }
                                  className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-purple-500/40"
                                  style={{ borderColor: "var(--border)" }}
                                />
                              </label>
                            ))}

                            <label className="block">
                              <span
                                className="text-xs font-medium uppercase tracking-wide"
                                style={{ color: "var(--muted)" }}
                              >
                                Sound effects
                              </span>
                              <textarea
                                value={scene.soundEffects.join("\n")}
                                onChange={(event) =>
                                  updateDetailedScene(
                                    scene.scene,
                                    "soundEffects",
                                    event.target.value
                                      .split("\n")
                                      .map((item) => item.trim())
                                      .filter(Boolean)
                                  )
                                }
                                rows={3}
                                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--border)" }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TEXT ON VIDEO */}
                  <div
                    className="mt-10 rounded-xl border p-5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="font-semibold">Text on video</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                      Choose whether the reel is visual-only, AI-directed, or
                      uses exactly the text you type.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {[
                        { value: false, label: "Visual only" },
                        { value: "ai", label: "AI suggested text" },
                        { value: "custom", label: "Type anything" },
                      ].map((option) => {
                        const current = plan.textStrategy.textRequired
                          ? plan.textStrategy.requestedText
                            ? "custom"
                            : "ai"
                          : false;

                        return (
                          <button
                            key={String(option.value)}
                            type="button"
                            onClick={() =>
                              updatePlan((currentPlan) => ({
                                ...currentPlan,
                                textStrategy: {
                                  ...currentPlan.textStrategy,
                                  textRequired: option.value !== false,
                                  requestedText:
                                    option.value === "custom"
                                      ? currentPlan.textStrategy.requestedText
                                      : option.value === "ai"
                                      ? currentPlan.textStrategy.requestedText
                                      : "",
                                  reason:
                                    option.value === false
                                      ? "Visual storytelling only."
                                      : option.value === "custom"
                                      ? "User supplied on-screen text."
                                      : "Postoll may suggest concise on-screen text.",
                                },
                              }))
                            }
                            className="rounded-full border px-4 py-2 text-sm transition"
                            style={{
                              borderColor:
                                current === option.value
                                  ? "#7C5CFF"
                                  : "var(--border)",
                              background:
                                current === option.value
                                  ? "rgba(124,92,255,.15)"
                                  : "transparent",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {plan.textStrategy.textRequired &&
                      (plan.textStrategy.requestedText ||
                        plan.textStrategy.reason ===
                          "User supplied on-screen text.") && (
                        <div className="mt-4">
                          <label className="block">
                            <span className="text-xs font-medium uppercase tracking-wide">
                              Type anything
                            </span>
                            <textarea
                              value={plan.textStrategy.requestedText}
                              onChange={(event) =>
                                updatePlan((currentPlan) => ({
                                  ...currentPlan,
                                  textStrategy: {
                                    ...currentPlan.textStrategy,
                                    requestedText: event.target.value,
                                    textRequired: true,
                                    reason: "User supplied on-screen text.",
                                  },
                                }))
                              }
                              placeholder="Example: CHASE YOUR DREAMS"
                              rows={3}
                              className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                              style={{ borderColor: "var(--border)" }}
                            />
                          </label>
                        </div>
                      )}
                  </div>

                  <div
                    className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Video generation stays locked until you approve this
                      script.
                    </p>

                    <button
                      type="button"
                      onClick={approveReelScript}
                      disabled={loading || generatingReel}
                      className="rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {reelScriptApproved
                        ? "✓ Script approved — edit to unlock again"
                        : "Approve script →"}
                    </button>
                  </div>
                </div>
              )}

              {/* CAPTION */}
              <div className="mt-8">
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                  Caption
                </p>
                <div
                  className="mt-2 rounded-xl border p-4 leading-7"
                  style={{ borderColor: "var(--border)" }}
                >
                  {plan.caption}
                </div>
              </div>

              {/* HASHTAGS */}
              <div className="mt-6">
                <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                  Hashtags
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.hashtags?.map((hashtag) => (
                    <span
                      key={hashtag}
                      className="rounded-full border px-3 py-1.5 text-sm"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>

              {/* REEL SCENES */}
              {reelSelected && plan.scenes && plan.scenes.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    Reel scenes
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {reelDuration === "15"
                      ? "15-second Reel"
                      : "30-second Reel"}
                  </p>

                  <div className="mt-3 space-y-3">
                    {plan.scenes.map((scene) => {
                      const sceneVideo = generatedVideos.find(
                        (video) => video.scene === scene.scene
                      );

                      return (
                        <div
                          key={scene.scene}
                          className="rounded-xl border p-4"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">
                              Scene {scene.scene}
                            </span>
                            <span className="text-sm" style={{ color: "var(--muted)" }}>
                              {scene.duration}
                            </span>
                          </div>

                          <p
                            className="mt-2 text-sm leading-6"
                            style={{ color: "var(--muted)" }}
                          >
                            {scene.description}
                          </p>

                          {sceneVideo && (
                            <div className="mt-4 overflow-hidden rounded-xl border">
                              <video
                                src={sceneVideo.video}
                                controls
                                playsInline
                                className="w-full"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ERRORS */}
              {imageError && (
                <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {imageError}
                </div>
              )}

              {reelError && (
                <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {reelError}
                </div>
              )}

              {/* ACTIONS */}
              <div
                className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-end"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  disabled={isBusy}
                  className="rounded-xl border px-5 py-3 text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                  onClick={handleEditPlan}
                >
                  ← Edit idea
                </button>

                {postSelected && (
                  <button
                    type="button"
                    disabled={generatingImage || generatingReel || savingContent}
                    className="rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={generateImage}
                  >
                    {generatingImage
                      ? "Generating creative..."
                      : "Approve & Generate Post →"}
                  </button>
                )}

                {reelSelected && (
                  <button
                    type="button"
                    disabled={generatingReel || generatingImage || savingContent}
                    className="rounded-xl bg-[#EC4899] px-5 py-3 text-sm font-bold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={generateReel}
                  >
                    {generatingReel
                      ? currentReelScene
                        ? `Generating scene ${currentReelScene}...`
                        : "Generating reel..."
                      : reelScriptApproved
                      ? "▶ Generate Reel →"
                      : "🔒 Approve Script to Generate Reel"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REEL GENERATION PROGRESS */}
        {generatingReel && plan && (
          <div
            className="mt-12 rounded-2xl border p-8 text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/15">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7C5CFF] border-t-transparent" />
            </div>

            <h2 className="mt-5 text-xl font-bold">
              Creating your reel scenes...
            </h2>

            <p
              className="mx-auto mt-2 max-w-md text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Postoll is generating each scene separately so every clip can be
              edited independently.
            </p>

            {currentReelScene !== null && (
              <p className="mt-4 text-sm font-bold text-[#C4B5FD]">
                Generating scene {currentReelScene} of {plan.scenes.length}
              </p>
            )}
          </div>
        )}

        {/* GENERATED REEL VIDEOS */}
        {generatedVideos.length > 0 && (
          <div ref={generatedReelRef} className="mt-12 scroll-mt-8">
            <div className="mb-5">
              <p className="text-sm font-bold text-[#C4B5FD]">
                ✦ Reel scenes generated
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                Your generated video scenes
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Each scene is available separately. You can review and edit the
                clips before creating the final reel.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {generatedVideos.map((generatedVideo) => {
                const scene = plan?.scenes.find(
                  (item) => item.scene === generatedVideo.scene
                );

                return (
                  <div
                    key={generatedVideo.scene}
                    className="overflow-hidden rounded-2xl border shadow-sm"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">
                          Scene {generatedVideo.scene}
                        </h3>

                        {scene?.duration && (
                          <span className="text-sm" style={{ color: "var(--muted)" }}>
                            {scene.duration}
                          </span>
                        )}
                      </div>

                      {scene?.description && (
                        <p
                          className="mt-2 text-sm leading-6"
                          style={{ color: "var(--muted)" }}
                        >
                          {scene.description}
                        </p>
                      )}
                    </div>

                    <div className="bg-black p-3">
                      <video
                        src={generatedVideo.video}
                        controls
                        playsInline
                        className="mx-auto max-h-[600px] w-full rounded-xl object-contain"
                      />
                    </div>

                    <div
                      className="flex items-center justify-between border-t p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        Generated scene clip
                      </span>

                      <a
                        href={generatedVideo.video}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Open video
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {reelError && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {reelError}
              </div>
            )}

            {!generatingReel &&
              generatedVideos.length < (plan?.scenes.length ?? 0) && (
                <div
                  className="mt-5 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  Some scenes were generated successfully. You can regenerate
                  the reel to try the remaining scenes again.
                </div>
              )}
          </div>
        )}

        {/* IMAGE LOADING */}
        {generatingImage && (
          <div
            className="mt-12 rounded-2xl border p-8 text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/15">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#7C5CFF] border-t-transparent" />
            </div>

            <h2 className="mt-5 text-xl font-bold">Creating your visual...</h2>
            <p
              className="mx-auto mt-2 max-w-md text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Postoll is turning your approved creative direction into a
              professional visual.
            </p>
            <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
              This may take a little while.
            </p>
          </div>
        )}

        {/* GENERATED IMAGE */}
        {generatedImage && (
          <div ref={generatedImageRef} className="mt-12 scroll-mt-8">
            <div className="mb-5">
              <p className="text-sm font-bold text-[#C4B5FD]">
                ✦ Creative generated
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                Your social media creative
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Your approved creative direction has been turned into a
                visual.
              </p>
            </div>

            <div
              className="overflow-hidden rounded-2xl border shadow-sm"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex justify-center bg-black/5 p-4 dark:bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedImage}
                  alt={plan?.title || "Generated social media creative"}
                  className="w-full max-w-2xl rounded-xl object-contain"
                />
              </div>

              <div
                className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  onClick={handleBackToPlan}
                  disabled={generatingImage || generatingReel || savingContent}
                  className="rounded-xl border px-5 py-3 text-sm font-medium transition hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  ← Back to plan
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={generateImage}
                    disabled={generatingImage || generatingReel || savingContent}
                    className="rounded-xl border px-5 py-3 text-sm font-medium transition hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {generatingImage ? "Generating..." : "↻ Regenerate"}
                  </button>

                  <button
                    type="button"
                    onClick={approveCreative}
                    disabled={generatingImage || generatingReel || savingContent}
                    className="rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingContent ? "Saving..." : "Approve Creative →"}
                  </button>
                </div>
              </div>
            </div>

            {imageError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {imageError}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

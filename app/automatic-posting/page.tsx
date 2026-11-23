"use client";

import { useState, type ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AspectRatio, ReferenceAsset, VisualStyle } from "@/app/types/ai-director";

type PlanOption = {
  id: string;
  label: string;
  style: VisualStyle;
  hint: string;
};

type UploadedPhotoItem = {
  id: string;
  name: string;
  previewUrl: string;
  file: File;
};

const PLAN_OPTIONS: PlanOption[] = [
  { id: "brand", label: "Brand", style: "brand", hint: "Consistent brand identity, clean visuals, and key message." },
  { id: "cartoon", label: "Cartoon", style: "cartoon", hint: "Animated cartoon look, expressive characters, and fun scenes." },
  { id: "product", label: "Product", style: "brand", hint: "Highlight product features, angles, and real-world use." },
  { id: "storytime", label: "Storytime", style: "storytime", hint: "Engaging narrative arc with hook, plot beats, and payoff." },
  { id: "educational", label: "Educational", style: "educational", hint: "Clear tips, step-by-step breakdowns, or quick insights." },
  { id: "talking_character", label: "Talking Character", style: "talking_character", hint: "Character-led delivery speaking directly to the viewer." },
  { id: "custom", label: "Custom", style: "brand", hint: "Describe your own plan type and custom rules from scratch." },
];

const PHOTO_RULE_PRESETS = [
  "Use this same image in all videos",
  "Use different images of the product",
  "Keep the main subject consistent across scenes",
  "Rotate uploaded photos across different posts",
];

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function AutomaticPostingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Plan & Details
  const [selectedPlanId, setSelectedPlanId] = useState<string>("brand");
  const [customPlanName, setCustomPlanName] = useState<string>("");
  const [workflowTitle, setWorkflowTitle] = useState<string>("");
  const [coreIdea, setCoreIdea] = useState<string>("");
  const [charactersAndTone, setCharactersAndTone] = useState<string>("");
  const [planExtraDetails, setPlanExtraDetails] = useState<string>("");

  // Step 2: Photos & Image Rule Text
  const [photos, setPhotos] = useState<UploadedPhotoItem[]>([]);
  const [photoRuleText, setPhotoRuleText] = useState<string>(
    "Use this same image in all videos"
  );

  // Step 3: Detailed Script & Reference Video Links
  const [detailedScript, setDetailedScript] = useState<string>("");
  const [hookAndCta, setHookAndCta] = useState<string>("");
  const [referenceVideoLinksText, setReferenceVideoLinksText] = useState<string>("");

  // Step 4: Schedule & Creation
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [postTime, setPostTime] = useState<string>("10:00");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [durationSeconds, setDurationSeconds] = useState<number>(15);
  const [autoPublish, setAutoPublish] = useState<boolean>(true);
  const [runFirstNow, setRunFirstNow] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    workflowId: string;
    name: string;
    slotsCount: number;
    runSummary?: string;
  } | null>(null);

  const activePlan =
    PLAN_OPTIONS.find((p) => p.id === selectedPlanId) ?? PLAN_OPTIONS[0];

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const nextItems: UploadedPhotoItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      file,
    }));

    setPhotos((prev) => [...prev, ...nextItems]);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }

  function toggleDay(dayValue: number) {
    setSelectedDays((prev) =>
      prev.includes(dayValue)
        ? prev.filter((d) => d !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    );
  }

  function resetBuilder() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setStep(1);
    setSelectedPlanId("brand");
    setCustomPlanName("");
    setWorkflowTitle("");
    setCoreIdea("");
    setCharactersAndTone("");
    setPlanExtraDetails("");
    setPhotos([]);
    setPhotoRuleText("Use this same image in all videos");
    setDetailedScript("");
    setHookAndCta("");
    setReferenceVideoLinksText("");
    setSelectedDays([1, 2, 3, 4, 5]);
    setPostTime("10:00");
    setAspectRatio("9:16");
    setDurationSeconds(15);
    setAutoPublish(true);
    setRunFirstNow(true);
    setError(null);
    setCreatedResult(null);
  }

  async function handleCreateAutomaticWorkflow() {
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Missing Supabase browser client configuration.");
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please sign in first to create an automatic posting workflow.");
      }

      if (!coreIdea.trim() && !detailedScript.trim()) {
        throw new Error("Please enter a core topic/idea or a detailed script before creating.");
      }

      if (selectedDays.length === 0) {
        throw new Error("Please select at least one posting day in Step 4.");
      }

      const planLabel =
        selectedPlanId === "custom" && customPlanName.trim()
          ? customPlanName.trim()
          : activePlan.label;

      const resolvedName =
        workflowTitle.trim() || `${planLabel} Automatic Video`;

      const referenceLinks = referenceVideoLinksText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const combinedBriefText = [
        `Plan Type: ${planLabel}`,
        planExtraDetails.trim() ? `Plan Details: ${planExtraDetails.trim()}` : "",
        coreIdea.trim() ? `Core Idea: ${coreIdea.trim()}` : "",
        photoRuleText.trim() ? `Photo Rule: ${photoRuleText.trim()}` : "",
        detailedScript.trim() ? `Detailed Script:\n${detailedScript.trim()}` : "",
        hookAndCta.trim() ? `Hook & CTA: ${hookAndCta.trim()}` : "",
        referenceLinks.length > 0
          ? `Reference Video Links:\n${referenceLinks.join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      // 1. Create workflow record
      const { data: wfData, error: wfError } = await supabase
        .from("workflows")
        .insert({
          user_id: user.id,
          name: resolvedName,
          source: "ai_generated",
          mode: "ai_generated",
          status: "active",
          active: true,
          description: combinedBriefText.slice(0, 1000),
        })
        .select("*")
        .single();

      if (wfError || !wfData?.id) {
        throw new Error(wfError?.message || "Failed to create workflow.");
      }

      const workflowId: string = wfData.id;

      // 2. Upload attached photos if provided
      const uploadedAssets: ReferenceAsset[] = [];
      const sameImageInAll = /same image|all videos|consistent|lock/i.test(
        photoRuleText
      );

      if (photos.length > 0) {
        const formData = new FormData();
        formData.append("workflowId", workflowId);
        formData.append("uploadDescription", photoRuleText.trim() || resolvedName);
        for (const p of photos) {
          formData.append("files", p.file, p.name);
        }

        const uploadRes = await fetch("/api/workflows/upload-content", {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json().catch(() => ({}));
        const urls: string[] = Array.isArray(uploadJson?.urls)
          ? uploadJson.urls
          : Array.isArray(uploadJson?.items)
          ? uploadJson.items
              .map((i: { image_url?: string; file_url?: string }) => i.image_url || i.file_url)
              .filter(Boolean)
          : [];

        urls.forEach((url, index) => {
          uploadedAssets.push({
            id: `photo-${index + 1}`,
            url,
            kind: selectedPlanId === "product" ? "product" : "character",
            label: photos[index]?.name || `Photo ${index + 1}`,
            lockAcrossRuns: sameImageInAll,
          });
        });
      }

      // 3. Save AI Director settings (script, photo rule, plan style, reference links)
      const patchRes = await fetch("/api/ai-director/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          settings: {
            content_format: "video",
            visual_style: activePlan.style,
            audio_mode:
              selectedPlanId === "talking_character"
                ? "talking_character"
                : "voiceover_music",
            aspect_ratio: aspectRatio,
            duration_seconds: durationSeconds,
            auto_publish: autoPublish,
            detailed_brief: {
              goal: `${planLabel} automatic video series`,
              coreIdea: coreIdea.trim() || detailedScript.trim().slice(0, 300),
              charactersAndTone:
                [
                  charactersAndTone.trim(),
                  planExtraDetails.trim()
                    ? `Plan notes: ${planExtraDetails.trim()}`
                    : "",
                  photoRuleText.trim()
                    ? `Photo usage rule: ${photoRuleText.trim()}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | ") || planLabel,
              pacingAndCta:
                hookAndCta.trim() || "Strong opening hook with clear call to action",
              avoidRules: "",
              storyArcNotes: [
                detailedScript.trim(),
                referenceLinks.length > 0
                  ? `Reference videos:\n${referenceLinks.join("\n")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
            reference_assets: uploadedAssets,
          },
        }),
      });

      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        throw new Error(patchErr?.error || "Failed to save AI Director script details.");
      }

      // 4. Create schedule slots for selected days
      const normalizedTime =
        postTime.length === 5 ? `${postTime}:00` : postTime || "10:00:00";
      const nowIso = new Date().toISOString();

      const slotRows = selectedDays.map((dayOfWeek, idx) => ({
        workflow_id: workflowId,
        user_id: user.id,
        day_of_week: dayOfWeek,
        slot_number: idx + 1,
        post_time: normalizedTime,
        content_type: "reel",
        enabled: true,
        updated_at: nowIso,
      }));

      const { error: slotError } = await supabase
        .from("workflow_schedule_slots")
        .insert(slotRows);

      if (slotError) {
        throw new Error(`Workflow created, but schedule slots failed: ${slotError.message}`);
      }

      // 5. Optionally trigger first daily AI generation right away
      let runSummary: string | undefined;
      if (runFirstNow) {
        const today = new Date().toISOString().slice(0, 10);
        const runRes = await fetch("/api/ai-director/run-daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, runDate: today }),
        });
        const runJson = await runRes.json().catch(() => ({}));
        if (runRes.ok) {
          runSummary = `Initial generation triggered for ${today} (job status: ${
            runJson?.job?.status || "started"
          }).`;
        } else {
          runSummary = `Workflow & schedule saved, though immediate run returned: ${
            runJson?.error || "check AI Director settings"
          }.`;
        }
      }

      setCreatedResult({
        workflowId,
        name: resolvedName,
        slotsCount: slotRows.length,
        runSummary,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create automatic posting workflow."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automatic Posting Setup</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Step-by-step setup to create a new automatic video content &amp; posting plan from your details.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { num: 1, title: "1. Plan & Details" },
          { num: 2, title: "2. Photos & Rule" },
          { num: 3, title: "3. Script & Links" },
          { num: 4, title: "4. Schedule & Launch" },
        ].map((item) => {
          const active = step === item.num;
          const done = step > item.num;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => {
                if (!createdResult) setStep(item.num as 1 | 2 | 3 | 4);
              }}
              className="rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors"
              style={{
                background: active ? "var(--foreground)" : "var(--card)",
                color: active ? "var(--background)" : "var(--foreground)",
                borderColor: active || done ? "var(--foreground)" : "var(--border)",
              }}
            >
              {item.title}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {createdResult ? (
        <div
          className="space-y-4 rounded-2xl border p-6"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-xl font-semibold">Automatic Video Workflow Created</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            <strong>{createdResult.name}</strong> is active with{" "}
            <strong>{createdResult.slotsCount}</strong> scheduled posting slot(s).
          </p>
          {createdResult.runSummary && (
            <p className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)" }}>
              {createdResult.runSummary}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              Create Another Automatic Plan
            </button>
          </div>
        </div>
      ) : (
        <div
          className="space-y-6 rounded-2xl border p-6"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">What is your plan like?</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Pick a plan style (Brand, Cartoon, Product, etc.) and enter your custom details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {PLAN_OPTIONS.map((option) => {
                  const isSelected = selectedPlanId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedPlanId(option.id)}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={{
                        background: isSelected ? "var(--foreground)" : "transparent",
                        color: isSelected ? "var(--background)" : "var(--foreground)",
                        borderColor: isSelected ? "var(--foreground)" : "var(--border)",
                      }}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div
                        className="mt-1 text-xs"
                        style={{
                          color: isSelected ? "var(--background)" : "var(--muted)",
                          opacity: isSelected ? 0.85 : 1,
                        }}
                      >
                        {option.hint}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPlanId === "custom" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Custom Plan Type Name
                  </label>
                  <input
                    type="text"
                    value={customPlanName}
                    onChange={(e) => setCustomPlanName(e.target.value)}
                    placeholder="e.g., Daily Motivation Shorts, Retro Comic Series..."
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Workflow / Series Name
                  </label>
                  <input
                    type="text"
                    value={workflowTitle}
                    onChange={(e) => setWorkflowTitle(e.target.value)}
                    placeholder="e.g., Morning Coffee Cartoon"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Characters, Audience &amp; Tone
                  </label>
                  <input
                    type="text"
                    value={charactersAndTone}
                    onChange={(e) => setCharactersAndTone(e.target.value)}
                    placeholder="e.g., Friendly cat mascot, witty & warm tone"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Core Topic / Main Idea
                </label>
                <input
                  type="text"
                  value={coreIdea}
                  onChange={(e) => setCoreIdea(e.target.value)}
                  placeholder="e.g., Short videos showing how our product solves everyday problems"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Additional Plan Details (Optional)
                </label>
                <textarea
                  rows={3}
                  value={planExtraDetails}
                  onChange={(e) => setPlanExtraDetails(e.target.value)}
                  placeholder="Enter any extra details about your brand, character traits, visual vibe, or rules..."
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Add Photos &amp; Image Usage Rule</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Upload photos and specify how they should be used—for example, using the same image in all videos or using different product images.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Upload Photos (Product, Character, or Reference Images)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="block w-full rounded-xl border p-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="h-28 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="truncate">{photo.name}</span>
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Quick Text Options for Photo Usage
                </label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {PHOTO_RULE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPhotoRuleText(preset)}
                      className="rounded-full border px-3 py-1.5 text-xs transition-colors"
                      style={{
                        background:
                          photoRuleText === preset ? "var(--foreground)" : "transparent",
                        color:
                          photoRuleText === preset ? "var(--background)" : "var(--foreground)",
                        borderColor: "var(--border)",
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <label className="mb-1.5 block text-sm font-medium">
                  Custom Photo Rule / Instructions
                </label>
                <textarea
                  rows={3}
                  value={photoRuleText}
                  onChange={(e) => setPhotoRuleText(e.target.value)}
                  placeholder="e.g., Use this same image in all videos, or use different images of the product for each scene..."
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Detailed Script &amp; Reference Video Links</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Write a detailed script of your content idea so the video generator understands the exact flow, plus optional reference video links.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Content Idea &amp; Detailed Script
                </label>
                <textarea
                  rows={7}
                  value={detailedScript}
                  onChange={(e) => setDetailedScript(e.target.value)}
                  placeholder="Write a detailed script or scene-by-scene content idea: opening hook, what happens in each part of the video, visual action, narration/dialogue, and ending..."
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Opening Hook &amp; Call to Action (Optional)
                </label>
                <input
                  type="text"
                  value={hookAndCta}
                  onChange={(e) => setHookAndCta(e.target.value)}
                  placeholder="e.g., Hook in first 2s with a surprising question; end with follow for part 2"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Reference Video Links (Optional — one URL per line)
                </label>
                <textarea
                  rows={3}
                  value={referenceVideoLinksText}
                  onChange={(e) => setReferenceVideoLinksText(e.target.value)}
                  placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.instagram.com/reel/..."}
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Posting Schedule &amp; Video Settings</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Choose when automatic generation and posting should run, then create your workflow.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Posting Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className="rounded-xl border px-3.5 py-2 text-xs font-semibold"
                        style={{
                          background: active ? "var(--foreground)" : "transparent",
                          color: active ? "var(--background)" : "var(--foreground)",
                          borderColor: active ? "var(--foreground)" : "var(--border)",
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Daily Post Time</label>
                  <input
                    type="time"
                    value={postTime}
                    onChange={(e) => setPostTime(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="9:16">9:16 (Vertical / Reels / Shorts)</option>
                    <option value="16:9">16:9 (Landscape / YouTube)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:5">4:5 (Portrait Feed)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Duration (seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value) || 15)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={autoPublish}
                    onChange={(e) => setAutoPublish(e.target.checked)}
                  />
                  <span>Enable automatic publishing when schedule slots trigger</span>
                </label>

                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={runFirstNow}
                    onChange={(e) => setRunFirstNow(e.target.checked)}
                  />
                  <span>Generate the first automatic video right after creating</span>
                </label>
              </div>

              <div
                className="space-y-1.5 rounded-xl border p-4 text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Summary
                </div>
                <div>
                  <strong>Plan:</strong>{" "}
                  {selectedPlanId === "custom" && customPlanName.trim()
                    ? customPlanName.trim()
                    : activePlan.label}
                </div>
                <div>
                  <strong>Photos attached:</strong> {photos.length}
                </div>
                <div>
                  <strong>Photo rule:</strong> {photoRuleText || "None specified"}
                </div>
                <div>
                  <strong>Script length:</strong> {detailedScript.trim().length} characters
                </div>
              </div>
            </div>
          )}

          {/* Navigation Footer: Back / Next / Create */}
          <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              disabled={step === 1 || submitting}
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))}
              className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40"
              style={{ borderColor: "var(--border)" }}
            >
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => ((prev + 1) as 1 | 2 | 3 | 4))}
                className="rounded-xl px-5 py-2 text-sm font-medium"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateAutomaticWorkflow}
                className="rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                }}
              >
                {submitting ? "Creating..." : "Create Automatic Workflow"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

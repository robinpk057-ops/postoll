"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { validateSafetyText } from "@/lib/safety-guardrail";
import type { AspectRatio, ReferenceAsset, VisualStyle } from "@/app/types/ai-director";

type PlanOption = {
  id: "business" | "cartoon" | "custom";
  label: string;
  style: VisualStyle;
  description: string;
};

type UploadedPhotoItem = {
  id: string;
  name: string;
  previewUrl: string;
  file: File;
};

type ConnectedAccount = {
  id: string;
  platform: string;
  account_handle: string;
  display_name: string | null;
  is_active: boolean;
};

type ClipScene = {
  sceneNumber?: number;
  visualPrompt?: string;
  narration?: string;
  durationSeconds?: number;
};

type StoryboardPreview = {
  hook?: string;
  angleSummary?: string;
  caption?: string;
  hashtags?: string[];
  scenes?: ClipScene[];
};

type GeneratedJobItem = {
  id: string;
  workflow_id: string;
  run_date: string;
  status: string;
  approval_status: string;
  target_account_ids: string[];
  credits_charged: number;
  credits_refunded: boolean;
  storyboard_json: StoryboardPreview | null;
  final_video_url?: string | null;
  created_at: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "business",
    label: "Business",
    style: "brand",
    description:
      "Polished brand messaging, product showcases, and value-driven short videos.",
  },
  {
    id: "cartoon",
    label: "Cartoon",
    style: "cartoon",
    description:
      "Illustrated scenes, recurring characters, and engaging animated storytelling.",
  },
  {
    id: "custom",
    label: "Custom",
    style: "brand",
    description:
      "Define your own category, creative direction, and automated video rules.",
  },
];

const PHOTO_RULE_PRESETS = [
  "Use this same image across all generated videos",
  "Use different product images per video or scene",
  "Keep the primary subject consistent across shots",
  "Cycle through uploaded reference images sequentially",
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

const inputClass =
  "w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-neutral-400 focus:border-white/50 focus:outline-none";

function clampDuration(value: number): number {
  if (Number.isNaN(value)) return 30;
  return value >= 22 ? 30 : 15;
}

export default function AutomaticPostingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Account & Credit state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [recentJobs, setRecentJobs] = useState<GeneratedJobItem[]>([]);
  const [loadingAccountData, setLoadingAccountData] = useState<boolean>(true);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState<boolean>(false);
  const [creditPackAmount, setCreditPackAmount] = useState<number>(10);
  const [buyingCredits, setBuyingCredits] = useState<boolean>(false);

  // Clip editing & regeneration state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editVisualPrompt, setEditVisualPrompt] = useState<string>("");
  const [editNarration, setEditNarration] = useState<string>("");
  const [regeneratingClipKey, setRegeneratingClipKey] = useState<string | null>(null);
  const [stitchingJobId, setStitchingJobId] = useState<string | null>(null);

  // Step 1
  const [selectedPlanId, setSelectedPlanId] = useState<"business" | "cartoon" | "custom">("business");
  const [customCategoryName, setCustomCategoryName] = useState<string>("");
  const [seriesName, setSeriesName] = useState<string>("");
  const [audienceAndTone, setAudienceAndTone] = useState<string>("");
  const [coreConcept, setCoreConcept] = useState<string>("");
  const [creativeNotes, setCreativeNotes] = useState<string>("");

  // Step 2
  const [photos, setPhotos] = useState<UploadedPhotoItem[]>([]);
  const [photoUsageRule, setPhotoUsageRule] = useState<string>(
    "Use this same image across all generated videos"
  );

  // Step 3
  const [scriptOutline, setScriptOutline] = useState<string>("");
  const [hookAndCta, setHookAndCta] = useState<string>("");
  const [referenceLinksText, setReferenceLinksText] = useState<string>("");

  // Step 4
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [postTime, setPostTime] = useState<string>("10:00");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [autoPublish, setAutoPublish] = useState<boolean>(true);
  const [runFirstNow, setRunFirstNow] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [retryingRun, setRetryingRun] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    workflowId: string;
    jobId?: string;
    name: string;
    slotsCount: number;
    runSummary?: string;
    storyboard?: StoryboardPreview;
  } | null>(null);

  const activePlan =
    PLAN_OPTIONS.find((p) => p.id === selectedPlanId) ?? PLAN_OPTIONS[0];

  const pendingApprovalJobs = recentJobs.filter(
    (j) => j.approval_status === "pending_approval" && j.status === "completed"
  );

  async function refreshAccountAndJobs() {
    setLoadingAccountData(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [billingRes, accountsRes, jobsRes] = await Promise.all([
        fetch("/api/billing/me", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        supabase
          .from("connected_accounts")
          .select("id, platform, account_handle, display_name, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("generation_jobs")
          .select(
            "id, workflow_id, run_date, status, approval_status, target_account_ids, credits_charged, credits_refunded, storyboard_json, final_video_url, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (typeof billingRes?.credits === "number") {
        setCreditBalance(billingRes.credits);
      }

      const accts = Array.isArray(accountsRes.data)
        ? (accountsRes.data as ConnectedAccount[])
        : [];
      setConnectedAccounts(accts);
      setSelectedAccountIds((prev) =>
        prev.length > 0 ? prev : accts.map((a) => a.id)
      );

      if (Array.isArray(jobsRes.data)) {
        setRecentJobs(jobsRes.data as GeneratedJobItem[]);
      }
    } finally {
      setLoadingAccountData(false);
    }
  }

  useEffect(() => {
    refreshAccountAndJobs();
  }, []);

  function toggleAccountSelection(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  }

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
    setSelectedPlanId("business");
    setCustomCategoryName("");
    setSeriesName("");
    setAudienceAndTone("");
    setCoreConcept("");
    setCreativeNotes("");
    setPhotos([]);
    setPhotoUsageRule("Use this same image across all generated videos");
    setScriptOutline("");
    setHookAndCta("");
    setReferenceLinksText("");
    setSelectedDays([1, 2, 3, 4, 5]);
    setPostTime("10:00");
    setAspectRatio("9:16");
    setDurationSeconds(30);
    setAutoPublish(true);
    setRunFirstNow(true);
    setError(null);
    setStatusMessage(null);
    setCreatedResult(null);
  }

  function startEditingClip(jobId: string, sceneIndex: number, scene: ClipScene) {
    setEditingJobId(jobId);
    setEditingSceneIndex(sceneIndex);
    setEditVisualPrompt(scene.visualPrompt || "");
    setEditNarration(scene.narration || "");
  }

  async function handleRegenerateSingleClip(
    jobId: string,
    sceneIndex: number,
    durationSec: number
  ) {
    setError(null);
    const key = `${jobId}-${sceneIndex}`;
    setRegeneratingClipKey(key);
    try {
      const res = await fetch("/api/ai-director/regenerate-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          sceneIndex,
          visualPrompt: editVisualPrompt,
          narration: editNarration,
          durationSeconds: durationSec || 10,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to regenerate clip.");
      }
      if (typeof json?.remainingCredits === "number") {
        setCreditBalance(json.remainingCredits);
      }
      setEditingJobId(null);
      setEditingSceneIndex(null);
      await refreshAccountAndJobs();
      if (createdResult?.jobId === jobId && json?.job?.storyboard_json) {
        setCreatedResult((prev) =>
          prev ? { ...prev, storyboard: json.job.storyboard_json } : prev
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip regeneration failed.");
      await refreshAccountAndJobs();
    } finally {
      setRegeneratingClipKey(null);
    }
  }

  async function handleCombineClipsAndPublish(job: GeneratedJobItem) {
    setError(null);
    setStitchingJobId(job.id);
    try {
      const targetIds =
        selectedAccountIds.length > 0
          ? selectedAccountIds
          : job.target_account_ids || [];

      const res = await fetch("/api/ai-director/stitch-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          targetAccountIds: targetIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to combine clips and publish.");
      }
      await refreshAccountAndJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stitch and publish failed.");
    } finally {
      setStitchingJobId(null);
    }
  }

  async function handleRetryInitialRun() {
    if (!createdResult) return;
    setRetryingRun(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const runRes = await fetch("/api/ai-director/run-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: createdResult.workflowId, runDate: today }),
      });
      const runJson = await runRes.json().catch(() => ({}));
      const sb: StoryboardPreview | undefined =
        runJson?.storyboard || runJson?.job?.storyboard_json;
      await refreshAccountAndJobs();
      setCreatedResult((prev) =>
        prev
          ? {
              ...prev,
              jobId: runJson?.job?.id || prev.jobId,
              storyboard: sb ?? prev.storyboard,
              runSummary: runRes.ok
                ? `Initial generation completed for ${today} (status: ${
                    runJson?.job?.status || "completed"
                  }).`
                : `Retry returned: ${runJson?.error || "Model still busy, try again shortly."}`,
            }
          : prev
      );
    } finally {
      setRetryingRun(false);
    }
  }

  async function handleCreateAutomaticWorkflow() {
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase browser client is not configured.");
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please sign in to create an automated posting workflow.");
      }

      const safetyCheck = validateSafetyText(
        `${seriesName}\n${coreConcept}\n${creativeNotes}\n${scriptOutline}\n${hookAndCta}`
      );
      if (!safetyCheck.allowed) {
        throw new Error(safetyCheck.reason);
      }

      if (!coreConcept.trim() && !scriptOutline.trim()) {
        throw new Error(
          "Please provide a core video concept or a detailed script before creating the workflow."
        );
      }

      if (selectedDays.length === 0) {
        throw new Error("Select at least one posting day in Step 4.");
      }

      if (runFirstNow && creditBalance !== null && creditBalance < 1) {
        throw new Error(
          "Insufficient credits (0 remaining). Add credits or uncheck immediate generation."
        );
      }

      const safeDuration = clampDuration(durationSeconds);
      const categoryLabel =
        selectedPlanId === "custom" && customCategoryName.trim()
          ? customCategoryName.trim()
          : activePlan.label;

      const resolvedName =
        seriesName.trim() || `${categoryLabel} Automated Video Series`;

      const referenceLinks = referenceLinksText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const combinedBriefText = [
        `Category: ${categoryLabel}`,
        `Publishing Mode: ${
          autoPublish ? "Publish video automatically" : "Ask approval before posting"
        }`,
        `Target Account IDs: ${selectedAccountIds.join(", ") || "All connected"}`,
        creativeNotes.trim() ? `Creative Notes: ${creativeNotes.trim()}` : "",
        coreConcept.trim() ? `Core Concept: ${coreConcept.trim()}` : "",
        photoUsageRule.trim() ? `Image Usage Rule: ${photoUsageRule.trim()}` : "",
        scriptOutline.trim() ? `Script & Scene Breakdown:\n${scriptOutline.trim()}` : "",
        hookAndCta.trim() ? `Hook & Call to Action: ${hookAndCta.trim()}` : "",
        referenceLinks.length > 0
          ? `Reference Video Links:\n${referenceLinks.join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

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
        throw new Error(wfError?.message || "Failed to create workflow record.");
      }

      const workflowId: string = wfData.id;

      const uploadedAssets: ReferenceAsset[] = [];
      const lockSameImage = /same image|all generated videos|consistent|lock/i.test(
        photoUsageRule
      );

      if (photos.length > 0) {
        const formData = new FormData();
        formData.append("workflowId", workflowId);
        formData.append("uploadDescription", photoUsageRule.trim() || resolvedName);
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
            id: `asset-${index + 1}`,
            url,
            kind: selectedPlanId === "business" ? "product" : "character",
            label: photos[index]?.name || `Reference Asset ${index + 1}`,
            lockAcrossRuns: lockSameImage,
          });
        });
      }

      const patchRes = await fetch("/api/ai-director/workflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          settings: {
            content_format: "video",
            visual_style: activePlan.style,
            audio_mode: "voiceover_music",
            aspect_ratio: aspectRatio,
            duration_seconds: safeDuration,
            auto_publish: autoPublish,
            detailed_brief: {
              goal: `${categoryLabel} automated short-form video workflow`,
              coreIdea: coreConcept.trim() || scriptOutline.trim().slice(0, 300),
              charactersAndTone:
                [
                  audienceAndTone.trim(),
                  creativeNotes.trim() ? `Creative notes: ${creativeNotes.trim()}` : "",
                  photoUsageRule.trim() ? `Image rule: ${photoUsageRule.trim()}` : "",
                ]
                  .filter(Boolean)
                  .join(" | ") || categoryLabel,
              pacingAndCta:
                hookAndCta.trim() ||
                "Clear opening hook within the first 2 seconds and a direct call to action",
              avoidRules: "",
              storyArcNotes: [
                scriptOutline.trim(),
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
        throw new Error(patchErr?.error || "Failed to save video generation settings.");
      }

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
        throw new Error(
          `Workflow was created, but schedule slots could not be saved: ${slotError.message}`
        );
      }

      let runSummary: string | undefined;
      let generatedStoryboard: StoryboardPreview | undefined;
      let createdJobId: string | undefined;

      if (runFirstNow) {
        const today = new Date().toISOString().slice(0, 10);
        for (let attempt = 1; attempt <= 3; attempt++) {
          setStatusMessage(
            attempt === 1
              ? "Triggering initial video generation..."
              : `Model experiencing high demand — retrying automatically (${attempt}/3)...`
          );
          const runRes = await fetch("/api/ai-director/run-daily", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId, runDate: today }),
          });
          const runJson = await runRes.json().catch(() => ({}));
          if (runRes.ok) {
            createdJobId = runJson?.job?.id;
            generatedStoryboard = runJson?.storyboard || runJson?.job?.storyboard_json;
            runSummary = `Initial generation completed for ${today} (${
              autoPublish
                ? "queued for scheduled auto-publish"
                : "awaiting your approval before posting"
            }).`;
            break;
          }
          const errText = String(runJson?.error || "");
          const isTransient = /503|UNAVAILABLE|high demand|overloaded|429/i.test(errText);
          if (!isTransient || attempt === 3) {
            runSummary = `Workflow and schedule saved. Initial run returned: ${
              errText || "check AI Director configuration"
            }.`;
            break;
          }
          await new Promise((r) => setTimeout(r, 2500 * attempt));
        }
        setStatusMessage(null);
      }

      await refreshAccountAndJobs();

      setCreatedResult({
        workflowId,
        jobId: createdJobId,
        name: resolvedName,
        slotsCount: slotRows.length,
        runSummary,
        storyboard: generatedStoryboard,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create automated posting workflow."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 text-white md:p-8">
      {/* Header + Credits + Back to Home */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Automated Video Posting Setup
          </h1>
          <p className="text-sm text-neutral-300">
            Generates content 30 minutes before scheduled slots. Full run: 1 credit · Single clip regen: 1 credit · Auto-refunded on failure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#141414] px-3.5 py-2 text-xs">
            <span className="text-neutral-400">Credit Balance: </span>
            <strong className="text-sm text-white">
              {loadingAccountData ? "..." : creditBalance ?? 0}
            </strong>
            <button
              type="button"
              onClick={() => setBuyCreditsOpen((prev) => !prev)}
              className="ml-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-neutral-200"
            >
              + Buy Credits
            </button>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[#141414] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/45"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      {buyCreditsOpen && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/20 bg-[#141414] p-4 text-sm">
          <div className="space-y-0.5">
            <div className="font-semibold text-white">Purchase / Top Up Credits</div>
            <p className="text-xs text-neutral-400">
              Adds credits immediately to the currently signed-in user&apos;s balance and records a purchase ledger entry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[10, 25, 50, 100].map((pack) => (
              <button
                key={pack}
                type="button"
                onClick={() => setCreditPackAmount(pack)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  creditPackAmount === pack
                    ? "border-white bg-white text-black"
                    : "border-white/20 bg-[#111111] text-neutral-200 hover:border-white/40"
                }`}
              >
                +{pack}
              </button>
            ))}
            <button
              type="button"
              disabled={buyingCredits}
              onClick={async () => {
                setError(null);
                setBuyingCredits(true);
                try {
                  const res = await fetch("/api/billing/me", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      credits: creditPackAmount,
                      note: `Purchased +${creditPackAmount} credits`,
                    }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(json?.error || "Failed to add credits.");
                  }
                  if (typeof json?.credits === "number") {
                    setCreditBalance(json.credits);
                  }
                  setBuyCreditsOpen(false);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not purchase credits."
                  );
                } finally {
                  setBuyingCredits(false);
                }
              }}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-300 disabled:opacity-50"
            >
              {buyingCredits ? "Adding..." : `Add ${creditPackAmount} Credits`}
            </button>
          </div>
        </div>
      )}

      {/* Pending Approval Notification Banner */}
      {pendingApprovalJobs.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="font-semibold">
            Approval Needed: {pendingApprovalJobs.length} generated video plan(s) waiting for review
          </div>
          <p className="mt-1 text-xs text-amber-200/90">
            Review individual clips below, regenerate any single clip if needed, and click{" "}
            <strong>Combine Clips &amp; Publish</strong> to post to your selected accounts.
          </p>
        </div>
      )}

      {/* Step Navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { num: 1, title: "1. Plan & Direction" },
          { num: 2, title: "2. Media & Image Rule" },
          { num: 3, title: "3. Script & References" },
          { num: 4, title: "4. Schedule & Specs" },
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
              className={`rounded-xl border px-3.5 py-3 text-left text-xs font-semibold transition-colors ${
                active
                  ? "border-white bg-white text-black"
                  : done
                  ? "border-white/35 bg-[#161616] text-white"
                  : "border-white/15 bg-[#111111] text-neutral-300 hover:border-white/30"
              }`}
            >
              {item.title}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/15 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {createdResult ? (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-[#111111] p-6">
          <h2 className="text-xl font-semibold text-white">
            Automated Video Workflow Created
          </h2>
          <p className="text-sm text-neutral-300">
            <strong className="text-white">{createdResult.name}</strong> is active with{" "}
            <strong className="text-white">{createdResult.slotsCount}</strong> scheduled posting slot(s).
          </p>
          {createdResult.runSummary && (
            <p className="rounded-xl border border-white/15 bg-[#161616] p-3.5 text-sm text-neutral-200">
              {createdResult.runSummary}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={retryingRun}
              onClick={handleRetryInitialRun}
              className="rounded-xl border border-white/25 bg-[#161616] px-4 py-2.5 text-sm font-semibold text-white hover:border-white/50 disabled:opacity-50"
            >
              {retryingRun ? "Retrying Generation..." : "Retry Initial Generation"}
            </button>
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200"
            >
              Create Another Workflow
            </button>
            <Link
              href="/"
              className="rounded-xl border border-white/20 bg-[#161616] px-4 py-2.5 text-sm font-medium text-white hover:border-white/40"
            >
              Return to Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-white/15 bg-[#111111] p-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Plan Category &amp; Creative Direction
                </h2>
                <p className="text-sm text-neutral-300">
                  Select Business or Cartoon—or enter a custom category—and define your video series details.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PLAN_OPTIONS.map((option) => {
                  const isSelected = selectedPlanId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedPlanId(option.id)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-white bg-white text-black"
                          : "border-white/15 bg-[#161616] text-white hover:border-white/35"
                      }`}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <p
                        className={`mt-1.5 text-xs leading-relaxed ${
                          isSelected ? "text-neutral-800" : "text-neutral-300"
                        }`}
                      >
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedPlanId === "custom" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Custom Plan Category
                  </label>
                  <input
                    type="text"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="Enter custom category name"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Series / Workflow Name
                  </label>
                  <input
                    type="text"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    placeholder="e.g., Weekly Product Spotlight"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Target Audience &amp; Tone
                  </label>
                  <input
                    type="text"
                    value={audienceAndTone}
                    onChange={(e) => setAudienceAndTone(e.target.value)}
                    placeholder="e.g., Small business owners; clear and friendly"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Core Topic &amp; Video Objective
                </label>
                <input
                  type="text"
                  value={coreConcept}
                  onChange={(e) => setCoreConcept(e.target.value)}
                  placeholder="e.g., Demonstrate practical workflows in short vertical videos"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Additional Creative Requirements (Optional)
                </label>
                <textarea
                  rows={3}
                  value={creativeNotes}
                  onChange={(e) => setCreativeNotes(e.target.value)}
                  placeholder="Specify visual palette, character traits, or styling guidelines..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Reference Photos &amp; Image Usage Rule
                </h2>
                <p className="text-sm text-neutral-300">
                  Upload reference or product photos and specify whether the system should reuse the same image or vary images across videos.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Upload Reference Images
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="block w-full rounded-xl border border-white/20 bg-[#141414] p-3 text-sm text-neutral-200 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
                />
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-white/15 bg-[#161616]"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="h-28 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-2 p-2.5 text-xs">
                        <span className="truncate text-neutral-200">{photo.name}</span>
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-100">
                  Suggested Image Usage Rules
                </label>
                <div className="flex flex-wrap gap-2">
                  {PHOTO_RULE_PRESETS.map((preset) => {
                    const active = photoUsageRule === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPhotoUsageRule(preset)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-white bg-white text-black"
                            : "border-white/20 bg-[#161616] text-neutral-200 hover:border-white/40"
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                <label className="block pt-1 text-sm font-medium text-neutral-100">
                  Image Usage Instructions
                </label>
                <textarea
                  rows={3}
                  value={photoUsageRule}
                  onChange={(e) => setPhotoUsageRule(e.target.value)}
                  placeholder="Describe how uploaded photos should be applied across generated videos..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Detailed Script &amp; Reference Video Links
                </h2>
                <p className="text-sm text-neutral-300">
                  Provide a structured script or scene plan for accurate video generation, plus optional reference video URLs.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Detailed Script / Scene-by-Scene Content Plan
                </label>
                <textarea
                  rows={7}
                  value={scriptOutline}
                  onChange={(e) => setScriptOutline(e.target.value)}
                  placeholder="Outline the opening hook, scene progression, narration/voiceover lines, on-screen visuals, and closing takeaway..."
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Hook &amp; Call to Action (Optional)
                </label>
                <input
                  type="text"
                  value={hookAndCta}
                  onChange={(e) => setHookAndCta(e.target.value)}
                  placeholder="e.g., Open with the core problem statement; close with a prompt to comment or visit the link"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Reference Video URLs (Optional — one link per line)
                </label>
                <textarea
                  rows={3}
                  value={referenceLinksText}
                  onChange={(e) => setReferenceLinksText(e.target.value)}
                  placeholder={"https://www.youtube.com/watch?v=example\nhttps://www.instagram.com/reel/example"}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-white">
                  Posting Schedule, Target Accounts &amp; Specifications
                </h2>
                <p className="text-sm text-neutral-300">
                  Content generates 30 minutes before your scheduled time. Select target accounts, framing, and duration (15s or 30s).
                </p>
              </div>

              {/* Target Social Accounts Picker */}
              <div className="space-y-2 rounded-xl border border-white/15 bg-[#161616] p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-white">
                    Target Accounts (Post only to selected accounts)
                  </label>
                  <Link
                    href="/accounts"
                    className="text-xs font-medium text-neutral-300 underline hover:text-white"
                  >
                    Manage Accounts
                  </Link>
                </div>

                {connectedAccounts.length === 0 ? (
                  <p className="text-xs text-neutral-400">
                    No active connected accounts found yet. Connect accounts on the{" "}
                    <Link href="/accounts" className="text-white underline">
                      Accounts page
                    </Link>{" "}
                    to target specific channels.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {connectedAccounts.map((acct) => {
                      const checked = selectedAccountIds.includes(acct.id);
                      return (
                        <button
                          key={acct.id}
                          type="button"
                          onClick={() => toggleAccountSelection(acct.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            checked
                              ? "border-white bg-white text-black"
                              : "border-white/20 bg-[#111111] text-neutral-300 hover:border-white/40"
                          }`}
                        >
                          {acct.platform}: {acct.display_name || acct.account_handle}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-100">
                  Publishing Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const active = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? "border-white bg-white text-black"
                            : "border-white/20 bg-[#161616] text-neutral-200 hover:border-white/40"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={postTime}
                    onChange={(e) => setPostTime(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    className={inputClass}
                  >
                    <option value="9:16">9:16 (Vertical Reels / Shorts)</option>
                    <option value="16:9">16:9 (Widescreen / YouTube)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:5">4:5 (Portrait Feed)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-100">
                    Video Duration
                  </label>
                  <select
                    value={durationSeconds}
                    onChange={(e) =>
                      setDurationSeconds(clampDuration(Number(e.target.value)))
                    }
                    className={inputClass}
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s (Max)</option>
                  </select>
                </div>
              </div>

              {/* Publish Automatically vs Ask Approval Toggle */}
              <div className="space-y-3 rounded-xl border border-white/15 bg-[#161616] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      {autoPublish
                        ? "Publish video automatically"
                        : "Ask approval before posting"}
                    </div>
                    <p className="text-xs text-neutral-300">
                      {autoPublish
                        ? "Clips generate 30 mins ahead, combine, and publish automatically at scheduled slot times."
                        : "Clips generate 30 mins ahead and wait for your review/clip edits before combining & posting."}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoPublish}
                    onClick={() => setAutoPublish((prev) => !prev)}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                      autoPublish
                        ? "border-white bg-white"
                        : "border-white/30 bg-[#262626]"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
                        autoPublish
                          ? "translate-x-7 bg-black"
                          : "translate-x-1 bg-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAutoPublish(true)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      autoPublish
                        ? "border-white bg-white text-black"
                        : "border-white/15 bg-[#111111] text-neutral-300 hover:border-white/35"
                    }`}
                  >
                    Publish video automatically
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPublish(false)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      !autoPublish
                        ? "border-white bg-white text-black"
                        : "border-white/15 bg-[#111111] text-neutral-300 hover:border-white/35"
                    }`}
                  >
                    Ask approval before posting
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    checked={runFirstNow}
                    onChange={(e) => setRunFirstNow(e.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  <span>Run initial video generation immediately (1 credit)</span>
                </label>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-white/15 pt-5">
            <button
              type="button"
              disabled={step === 1 || submitting}
              onClick={() =>
                setStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))
              }
              className="rounded-xl border border-white/20 bg-[#161616] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/40 disabled:opacity-40"
            >
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => ((prev + 1) as 1 | 2 | 3 | 4))}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCreateAutomaticWorkflow}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
              >
                {submitting ? statusMessage || "Creating..." : "Create Workflow"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generated Content, Clip-by-Clip Editor, Single-Clip Regeneration & Final Stitch/Publish */}
      {recentJobs.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-white/15 bg-[#111111] p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">
              Generated Content &amp; Clip Studio
            </h2>
            <p className="text-xs text-neutral-300">
              View individual clips separately, edit and regenerate a single clip (1 credit), or combine all clips and publish to your selected accounts.
            </p>
          </div>

          <div className="space-y-5">
            {recentJobs.map((job) => {
              const scenes = Array.isArray(job.storyboard_json?.scenes)
                ? job.storyboard_json!.scenes!
                : [];
              return (
                <div
                  key={job.id}
                  className="space-y-4 rounded-xl border border-white/15 bg-[#161616] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {job.storyboard_json?.hook || `Run ${job.run_date}`}
                      </div>
                      <div className="text-xs text-neutral-400">
                        Status: <strong className="text-neutral-200">{job.status}</strong> ·
                        Approval:{" "}
                        <strong className="text-neutral-200">{job.approval_status}</strong> ·
                        Credits charged: {job.credits_charged}
                        {job.credits_refunded ? " (Refunded)" : ""}
                      </div>
                    </div>

                    {job.status === "completed" && (
                      <button
                        type="button"
                        disabled={stitchingJobId === job.id}
                        onClick={() => handleCombineClipsAndPublish(job)}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
                      >
                        {stitchingJobId === job.id
                          ? "Combining & Publishing..."
                          : "Combine Clips & Publish"}
                      </button>
                    )}
                  </div>

                  {job.storyboard_json?.caption && (
                    <p className="rounded-lg border border-white/10 bg-[#111111] p-3 text-xs text-neutral-200">
                      {job.storyboard_json.caption}
                    </p>
                  )}

                  {scenes.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {scenes.map((scene, idx) => {
                        const isEditing =
                          editingJobId === job.id && editingSceneIndex === idx;
                        const clipKey = `${job.id}-${idx}`;
                        return (
                          <div
                            key={idx}
                            className="space-y-2 rounded-xl border border-white/15 bg-[#111111] p-3.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                Clip {scene.sceneNumber ?? idx + 1} (
                                {scene.durationSeconds ?? 10}s)
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  isEditing
                                    ? setEditingJobId(null)
                                    : startEditingClip(job.id, idx, scene)
                                }
                                className="text-neutral-300 underline hover:text-white"
                              >
                                {isEditing ? "Cancel" : "Edit / Regenerate Clip"}
                              </button>
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  rows={2}
                                  value={editVisualPrompt}
                                  onChange={(e) => setEditVisualPrompt(e.target.value)}
                                  placeholder="Visual prompt for this clip..."
                                  className={inputClass}
                                />
                                <textarea
                                  rows={2}
                                  value={editNarration}
                                  onChange={(e) => setEditNarration(e.target.value)}
                                  placeholder="Narration for this clip..."
                                  className={inputClass}
                                />
                                <button
                                  type="button"
                                  disabled={regeneratingClipKey === clipKey}
                                  onClick={() =>
                                    handleRegenerateSingleClip(
                                      job.id,
                                      idx,
                                      scene.durationSeconds || 10
                                    )
                                  }
                                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
                                >
                                  {regeneratingClipKey === clipKey
                                    ? "Regenerating Clip..."
                                    : "Regenerate Only This Clip (1 Credit)"}
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="text-neutral-300">
                                  <strong className="text-neutral-100">Visual:</strong>{" "}
                                  {scene.visualPrompt}
                                </div>
                                <div className="text-neutral-300">
                                  <strong className="text-neutral-100">Narration:</strong>{" "}
                                  {scene.narration}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


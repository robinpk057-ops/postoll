import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import { getPlanConfig } from "@/lib/plans";

import {
  publishInstagramPost,
  PublishPostError,
} from "@/lib/instagram/publishPost";

import {
  publishFacebookPost,
  PublishFacebookError,
} from "@/lib/facebook/publishPost";

import {
  publishYouTubeVideo,
  PublishYouTubeError,
} from "@/lib/youtube/publishPost";

import {
  publishTikTokVideo,
  PublishTikTokError,
} from "@/lib/tiktok/publishPost";

import {
  publishLinkedInPost,
  PublishLinkedInError,
} from "@/lib/linkedin/publishPost";

export const maxDuration = 120;

const WINDOW_MINUTES = 15;
const WORKFLOW_STAGGER_MINUTES = 15;
const MAX_PUBLISH_ATTEMPTS = 2;
const EXCLUDED_CALENDAR_PLATFORMS = new Set(["x", "twitter"]);
const DEFAULT_TIMEZONE = "America/New_York";

/*
 * ================================================================
 * TIME HELPERS (timezone-aware)
 * ================================================================
 */

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getZonedDayOfWeek(date: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    });
    const weekday = formatter.format(date);
    return WEEKDAY_TO_NUMBER[weekday] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}

function getZonedTimeMinutes(date: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((part) => part.type === "hour")?.value;
    const minutePart = parts.find((part) => part.type === "minute")?.value;

    let hour = Number(hourPart);
    const minute = Number(minutePart);
    if (hour === 24) hour = 0;

    return (
      (Number.isFinite(hour) ? hour : 0) * 60 +
      (Number.isFinite(minute) ? minute : 0)
    );
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

function getZonedDateString(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function timeStringToMinutes(time: string): number {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  return (
    (Number.isFinite(hours) ? hours : 0) * 60 +
    (Number.isFinite(minutes) ? minutes : 0)
  );
}

/*
 * ================================================================
 * DURATION / EXPIRY CHECK
 * ================================================================
 */

const DURATION_MONTHS: Record<string, number> = {
  "1_month": 1,
  "3_months": 3,
  "6_months": 6,
  "12_months": 12,
};

function isWorkflowExpired(
  createdAt: string,
  settings:
    | {
        duration_type: string | null;
        start_date: string | null;
        end_date: string | null;
      }
    | undefined,
  todayDateString: string
): boolean {
  if (!settings?.duration_type) {
    return false;
  }

  const { duration_type, start_date, end_date } = settings;
  if (duration_type === "unlimited") {
    return false;
  }

  if (end_date) {
    return todayDateString > end_date;
  }

  if (duration_type === "custom") {
    return false;
  }

  const months = DURATION_MONTHS[duration_type];
  if (!months) {
    return false;
  }

  const startIso = start_date ? `${start_date}T00:00:00.000Z` : createdAt;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return false;
  }

  const expiry = new Date(start);
  expiry.setUTCMonth(expiry.getUTCMonth() + months);

  const today = new Date(`${todayDateString}T00:00:00.000Z`);
  return today.getTime() > expiry.getTime();
}

/*
 * ================================================================
 * TYPES & ISOLATED PUBLISHING HELPERS
 * ================================================================
 */

type ScheduleRunInsert = {
  schedule_slot_id: string;
  workflow_id: string;
  run_date: string;
  status: "success" | "failed" | "skipped";
  content_id: string | null;
  error_message: string | null;
};

type ScheduleSlot = {
  id: string;
  workflow_id: string;
  day_of_week: number;
  slot_number: number;
  post_time: string;
  content_type: string;
  enabled: boolean;
  pending_post_time?: string | null;
  effective_from_date?: string | null;
};

type WorkflowSettingsRow = {
  workflow_id: string;
  duration_type: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
};

type DueSlot = {
  slot: ScheduleSlot;
  workflowId: string;
  userId: string;
  timezone: string;
  runDate: string;
};

type PublishTarget = {
  platform: string;
  account_id: string | null;
};

type TargetOutcome = {
  platform: string;
  accountId: string | null;
  ok: boolean;
  attempts: number;
  error?: string;
};

function getErrorMessage(err: unknown): string {
  if (
    err instanceof PublishFacebookError ||
    err instanceof PublishPostError ||
    err instanceof PublishYouTubeError ||
    err instanceof PublishTikTokError ||
    err instanceof PublishLinkedInError ||
    err instanceof Error
  ) {
    return err.message;
  }
  return "Publish failed";
}

async function publishSingleTargetWithRetry(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  contentId: string;
  workflowId: string | null;
  target: PublishTarget;
}): Promise<TargetOutcome> {
  const { supabaseAdmin, userId, contentId, workflowId, target } = params;
  const platform = (target.platform || "").trim().toLowerCase();
  let lastError = "Publish failed";

  for (let attempt = 1; attempt <= MAX_PUBLISH_ATTEMPTS; attempt++) {
    try {
      if (platform === "facebook") {
        await publishFacebookPost(userId, contentId);
      } else if (platform === "instagram") {
        await publishInstagramPost(userId, contentId);
      } else if (platform === "youtube") {
        await publishYouTubeVideo(userId, contentId, workflowId, target.account_id);
      } else if (platform === "tiktok") {
        await publishTikTokVideo(userId, contentId, workflowId, target.account_id);
      } else if (platform === "linkedin") {
        await publishLinkedInPost(userId, contentId, workflowId, target.account_id);
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      return {
        platform,
        accountId: target.account_id,
        ok: true,
        attempts: attempt,
      };
    } catch (err) {
      lastError = getErrorMessage(err);
      await flagAccountReconnectNeeded(
        supabaseAdmin,
        userId,
        platform,
        target.account_id,
        lastError
      );

      if (attempt < MAX_PUBLISH_ATTEMPTS && !isAuthReconnectError(lastError)) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return {
    platform,
    accountId: target.account_id,
    ok: false,
    attempts: MAX_PUBLISH_ATTEMPTS,
    error: lastError,
  };
}

async function publishAcrossTargetsIsolated(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  contentId: string;
  workflowId: string | null;
  targets: PublishTarget[];
}): Promise<{
  outcomes: TargetOutcome[];
  succeededCount: number;
  failedCount: number;
  errors: string[];
}> {
  const settled = await Promise.allSettled(
    params.targets.map((target) =>
      publishSingleTargetWithRetry({
        supabaseAdmin: params.supabaseAdmin,
        userId: params.userId,
        contentId: params.contentId,
        workflowId: params.workflowId,
        target,
      })
    )
  );

  const outcomes: TargetOutcome[] = settled.map((item, idx) => {
    if (item.status === "fulfilled") {
      return item.value;
    }
    const fallbackPlatform = (params.targets[idx]?.platform || "unknown").toLowerCase();
    return {
      platform: fallbackPlatform,
      accountId: params.targets[idx]?.account_id ?? null,
      ok: false,
      attempts: MAX_PUBLISH_ATTEMPTS,
      error: getErrorMessage(item.reason),
    };
  });

  const succeededCount = outcomes.filter((o) => o.ok).length;
  const failedOutcomes = outcomes.filter((o) => !o.ok);
  const errors = failedOutcomes.map(
    (o) => `${o.platform} (attempt ${o.attempts}): ${o.error || "Publish failed"}`
  );

  return {
    outcomes,
    succeededCount,
    failedCount: failedOutcomes.length,
    errors,
  };
}

/*
 * ================================================================
 * ROUTE
 * ================================================================
 */

export async function POST(request: Request) {
  return handleScheduler(request);
}

export async function GET(request: Request) {
  return handleScheduler(request);
}

async function handleScheduler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server is missing required Supabase configuration." },
      { status: 500 }
    );
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await recoverStuckPublishingContent(supabaseAdmin);
  const now = new Date();

  const results: Array<{
    scheduleSlotId: string;
    workflowId: string;
    status: string;
    detail?: string;
    targets?: TargetOutcome[];
  }> = [];

  const dueSlots: DueSlot[] = [];

  try {
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from("workflow_schedule_slots")
      .select(
        "id, workflow_id, day_of_week, slot_number, post_time, content_type, enabled, pending_post_time, effective_from_date"
      )
      .eq("enabled", true);

    if (slotsError) {
      console.error("Scheduler slots lookup error:", slotsError);
      return NextResponse.json(
        { error: slotsError.message || "Unable to load schedule slots." },
        { status: 500 }
      );
    }

    const allSlots: ScheduleSlot[] = slots ?? [];

    if (allSlots.length > 0) {
      const workflowIds = Array.from(
        new Set(allSlots.map((slot) => slot.workflow_id))
      );

      const { data: workflows, error: workflowsError } = await supabaseAdmin
        .from("workflows")
        .select("id, user_id, active, status, created_at")
        .in("id", workflowIds)
        .order("created_at", { ascending: true });

      if (workflowsError) {
        console.error("Scheduler workflows lookup error:", workflowsError);
        return NextResponse.json(
          { error: workflowsError.message || "Unable to load workflows." },
          { status: 500 }
        );
      }

      const workflowList = workflows ?? [];
      const userIds = Array.from(new Set(workflowList.map((w) => w.user_id)));

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, plan_tier")
        .in("id", userIds);

      const planByUserId = new Map<string, string | null>(
        (profiles ?? []).map((p) => [p.id, p.plan_tier ?? null])
      );

      // Enforce per-plan active workflow limit and assign deterministic stagger index per user
      const allowedWorkflowIds = new Set<string>();
      const workflowStaggerMinutes = new Map<string, number>();
      const workflowsByUser = new Map<string, typeof workflowList>();

      for (const wf of workflowList) {
        const list = workflowsByUser.get(wf.user_id) ?? [];
        list.push(wf);
        workflowsByUser.set(wf.user_id, list);
      }

      for (const [uid, uWorkflows] of workflowsByUser.entries()) {
        const plan = getPlanConfig(planByUserId.get(uid));
        uWorkflows.forEach((wf, index) => {
          if (wf.active === true && index < plan.maxWorkflows) {
            allowedWorkflowIds.add(wf.id);
            workflowStaggerMinutes.set(wf.id, index * WORKFLOW_STAGGER_MINUTES);
          }
        });
      }

      const workflowMap = new Map(
        workflowList.map((workflow) => [workflow.id, workflow])
      );

      const { data: settingsRows, error: settingsError } = await supabaseAdmin
        .from("workflow_settings")
        .select("workflow_id, duration_type, start_date, end_date, timezone")
        .in("workflow_id", workflowIds);

      if (settingsError) {
        console.error("Scheduler settings lookup error:", settingsError);
      }

      const settingsMap = new Map<string, WorkflowSettingsRow>(
        (settingsRows ?? []).map((row) => [
          row.workflow_id,
          row as WorkflowSettingsRow,
        ])
      );

      for (const slot of allSlots) {
        if (slot.pending_post_time && slot.effective_from_date) {
          const wf = workflowMap.get(slot.workflow_id);
          if (wf) {
            const tz = settingsMap.get(slot.workflow_id)?.timezone || DEFAULT_TIMEZONE;
            const localDate = getZonedDateString(now, tz);
            if (localDate >= slot.effective_from_date) {
              await supabaseAdmin
                .from("workflow_schedule_slots")
                .update({
                  post_time: slot.pending_post_time,
                  pending_post_time: null,
                  effective_from_date: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", slot.id);
              slot.post_time = slot.pending_post_time;
              slot.pending_post_time = null;
              slot.effective_from_date = null;
            }
          }
        }
      }

      for (const slot of allSlots) {
        const workflow = workflowMap.get(slot.workflow_id);
        if (!workflow || workflow.active !== true) {
          continue;
        }
        if (!allowedWorkflowIds.has(slot.workflow_id)) {
          continue;
        }

        const settings = settingsMap.get(slot.workflow_id);
        const timezone = settings?.timezone || DEFAULT_TIMEZONE;

        const zonedDow = getZonedDayOfWeek(now, timezone);
        const zonedMinutes = getZonedTimeMinutes(now, timezone);

        if (slot.day_of_week !== zonedDow) {
          continue;
        }

        const staggerOffset = workflowStaggerMinutes.get(slot.workflow_id) ?? 0;
        const effectiveSlotMinutes =
          (timeStringToMinutes(slot.post_time) + staggerOffset) % (24 * 60);
        const diff = Math.abs(zonedMinutes - effectiveSlotMinutes);

        if (diff > WINDOW_MINUTES) {
          continue;
        }

        dueSlots.push({
          slot,
          workflowId: slot.workflow_id,
          userId: workflow.user_id,
          timezone,
          runDate: getZonedDateString(now, timezone),
        });
      }

      for (const due of dueSlots) {
        const { slot, workflowId, userId, runDate } = due;
        const workflow = workflowMap.get(workflowId)!;
        const settings = settingsMap.get(workflowId);

        if (isWorkflowExpired(workflow.created_at, settings, runDate)) {
          await supabaseAdmin
            .from("workflows")
            .update({ active: false, status: "completed" })
            .eq("id", workflowId);

          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "skipped",
            content_id: null,
            error_message: "Workflow duration has ended; workflow deactivated.",
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "skipped",
            detail: "Workflow duration has ended.",
          });

          continue;
        }

        const { data: existingRun, error: existingRunError } = await supabaseAdmin
          .from("workflow_schedule_runs")
          .select("id")
          .eq("schedule_slot_id", slot.id)
          .eq("run_date", runDate)
          .maybeSingle();

        if (existingRunError) {
          console.error("Scheduler existing-run lookup error:", existingRunError);
          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "error",
            detail: existingRunError.message,
          });
          continue;
        }

        if (existingRun) {
          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "already_run",
          });
          continue;
        }

        let queuedContent: {
          id: string;
          type: string;
          status: string;
        } | null = null;

        const { data: queuedRow, error: queuedContentError } =
          await supabaseAdmin
            .from("content")
            .select("id, type, status")
            .eq("workflow_id", workflowId)
            .eq("status", "queued")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (queuedContentError) {
          console.error("Scheduler content lookup error:", queuedContentError);
          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "failed",
            content_id: null,
            error_message: queuedContentError.message,
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "failed",
            detail: queuedContentError.message,
          });
          continue;
        }

        queuedContent = queuedRow;

        if (!queuedContent) {
          const { data: workflowMeta } = await supabaseAdmin
            .from("workflows")
            .select("id, source, mode")
            .eq("id", workflowId)
            .maybeSingle();

          const isUserUpload =
            workflowMeta?.source === "user_uploaded" ||
            workflowMeta?.mode === "user_uploaded";

          if (!isUserUpload) {
            try {
              const origin = new URL(request.url).origin;
              const genRes = await fetch(`${origin}/api/ai-director/run-daily`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${cronSecret}`,
                },
                body: JSON.stringify({ workflowId, runDate }),
              });

              const genJson = await genRes.json().catch(() => ({}));
              if (!genRes.ok) {
                throw new Error(
                  genJson?.error || `Daily generation failed (${genRes.status})`
                );
              }

              const { data: newlyQueued, error: requeueError } =
                await supabaseAdmin
                  .from("content")
                  .select("id, type, status")
                  .eq("workflow_id", workflowId)
                  .eq("status", "queued")
                  .order("created_at", { ascending: true })
                  .limit(1)
                  .maybeSingle();

              if (requeueError) {
                throw new Error(requeueError.message);
              }

              queuedContent = newlyQueued;
            } catch (genErr) {
              const msg =
                genErr instanceof Error
                  ? genErr.message
                  : "Daily generation failed.";
              await insertRun(supabaseAdmin, {
                schedule_slot_id: slot.id,
                workflow_id: workflowId,
                run_date: runDate,
                status: "failed",
                content_id: null,
                error_message: msg,
              });

              results.push({
                scheduleSlotId: slot.id,
                workflowId,
                status: "failed",
                detail: msg,
              });
              continue;
            }

            if (!queuedContent) {
              await insertRun(supabaseAdmin, {
                schedule_slot_id: slot.id,
                workflow_id: workflowId,
                run_date: runDate,
                status: "skipped",
                content_id: null,
                error_message:
                  "No queued content available after daily generation.",
              });

              results.push({
                scheduleSlotId: slot.id,
                workflowId,
                status: "skipped",
                detail: "No queued content available after daily generation.",
              });
              continue;
            }
          }

          if (!queuedContent) {
            const { data: allContent, error: allContentError } =
              await supabaseAdmin
                .from("content")
                .select(
                  "id, type, title, caption, hashtags, image_url, platform, status, created_at"
                )
                .eq("workflow_id", workflowId)
                .not("image_url", "is", null)
                .order("created_at", { ascending: true });

            if (allContentError || !allContent || allContent.length === 0) {
              await insertRun(supabaseAdmin, {
                schedule_slot_id: slot.id,
                workflow_id: workflowId,
                run_date: runDate,
                status: "skipped",
                content_id: null,
                error_message:
                  "No content available to rotate for this workflow.",
              });

              results.push({
                scheduleSlotId: slot.id,
                workflowId,
                status: "skipped",
                detail: "No content available to rotate.",
              });
              continue;
            }

            type MediaTemplate = {
              type: string;
              title: string | null;
              caption: string | null;
              hashtags: string[] | null;
              image_url: string;
              platform: string | null;
            };

            const library: MediaTemplate[] = [];
            const seenUrls = new Set<string>();

            for (const row of allContent) {
              if (!row.image_url || seenUrls.has(row.image_url)) continue;
              seenUrls.add(row.image_url);
              library.push({
                type: row.type || "post",
                title: row.title ?? null,
                caption: row.caption ?? null,
                hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
                image_url: row.image_url,
                platform: row.platform ?? "instagram",
              });
            }

            if (library.length === 0) {
              await insertRun(supabaseAdmin, {
                schedule_slot_id: slot.id,
                workflow_id: workflowId,
                run_date: runDate,
                status: "skipped",
                content_id: null,
                error_message: "No media library to rotate.",
              });

              results.push({
                scheduleSlotId: slot.id,
                workflowId,
                status: "skipped",
                detail: "No media library to rotate.",
              });
              continue;
            }

            const published = allContent
              .filter((row) => row.status === "published")
              .sort((a, b) =>
                String(b.created_at).localeCompare(String(a.created_at))
              );

            const lastUrl = published[0]?.image_url ?? null;
            let nextIndex = 0;

            if (lastUrl) {
              const lastIndex = library.findIndex(
                (item) => item.image_url === lastUrl
              );
              if (lastIndex >= 0) {
                nextIndex = (lastIndex + 1) % library.length;
              }
            }

            const template = library[nextIndex];

            const { data: cycled, error: cycleError } = await supabaseAdmin
              .from("content")
              .insert({
                user_id: userId,
                workflow_id: workflowId,
                type: template.type,
                title: template.title,
                caption: template.caption,
                hashtags: template.hashtags || [],
                image_url: template.image_url,
                platform: template.platform || "instagram",
                status: "queued",
              })
              .select("id, type, status")
              .single();

            if (cycleError || !cycled) {
              console.error("Rotate content insert error:", cycleError);
              await insertRun(supabaseAdmin, {
                schedule_slot_id: slot.id,
                workflow_id: workflowId,
                run_date: runDate,
                status: "failed",
                content_id: null,
                error_message:
                  cycleError?.message ||
                  "Failed to rotate content for this workflow.",
              });

              results.push({
                scheduleSlotId: slot.id,
                workflowId,
                status: "failed",
                detail: "Failed to rotate content.",
              });
              continue;
            }

            queuedContent = cycled;
          }
        }

        const { data: claimedContent, error: claimError } = await supabaseAdmin
          .from("content")
          .update({ status: "publishing" })
          .eq("id", queuedContent.id)
          .eq("status", "queued")
          .select()
          .maybeSingle();

        if (claimError || !claimedContent) {
          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "skipped",
            content_id: queuedContent.id,
            error_message:
              "Content was already claimed by another schedule slot.",
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "skipped",
            detail: "Content already claimed.",
          });
          continue;
        }

        try {
          const { data: workflowAccounts, error: waError } = await supabaseAdmin
            .from("workflow_accounts")
            .select("platform, account_id")
            .eq("workflow_id", workflowId);

          if (waError) {
            throw new Error(waError.message);
          }

          const accounts = workflowAccounts ?? [];
          const targets: PublishTarget[] =
            accounts.length > 0
              ? accounts
              : [{ platform: "instagram", account_id: null }];

          const batch = await publishAcrossTargetsIsolated({
            supabaseAdmin,
            userId,
            contentId: claimedContent.id,
            workflowId,
            targets,
          });

          if (batch.succeededCount === 0) {
            throw new Error(batch.errors.join(" | ") || "All targets failed.");
          }

          await supabaseAdmin
            .from("content")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
            })
            .eq("id", claimedContent.id);

          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "success",
            content_id: claimedContent.id,
            error_message:
              batch.failedCount > 0
                ? `Partial (${batch.succeededCount}/${targets.length}): ${batch.errors.join(" | ")}`
                : null,
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "success",
            detail:
              batch.failedCount > 0
                ? `Partial (${batch.succeededCount}/${targets.length}): ${batch.errors.join(" | ")}`
                : undefined,
            targets: batch.outcomes,
          });
        } catch (publishError) {
          await supabaseAdmin
            .from("content")
            .update({ status: "queued" })
            .eq("id", claimedContent.id);

          const message = getErrorMessage(publishError);

          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "failed",
            content_id: claimedContent.id,
            error_message: message,
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "failed",
            detail: message,
          });
        }
      }
    }

    const calendarResults: Array<{
      id: string;
      platform?: string;
      status: string;
      detail?: string;
    }> = [];

    const { data: calendarRows, error: calendarError } = await supabaseAdmin
      .from("calendar_posts")
      .select(
        "id, user_id, account_id, platform, scheduled_date, scheduled_time, timezone, media_url, caption, status"
      )
      .eq("status", "scheduled");

    if (calendarError) {
      console.error("Calendar posts lookup error:", calendarError);
    } else {
      for (const row of calendarRows ?? []) {
        const platform = (row.platform || "").trim().toLowerCase();
        if (!platform || EXCLUDED_CALENDAR_PLATFORMS.has(platform)) {
          continue;
        }

        const tz = row.timezone || DEFAULT_TIMEZONE;
        const localDate = getZonedDateString(now, tz);
        const localMinutes = getZonedTimeMinutes(now, tz);
        const slotMinutes = timeStringToMinutes(
          String(row.scheduled_time).slice(0, 5)
        );
        const diff = Math.abs(localMinutes - slotMinutes);

        if (row.scheduled_date !== localDate) continue;
        if (diff > WINDOW_MINUTES) continue;

        const { data: claimed, error: claimErr } = await supabaseAdmin
          .from("calendar_posts")
          .update({ status: "publishing" })
          .eq("id", row.id)
          .eq("status", "scheduled")
          .select()
          .maybeSingle();

        if (claimErr || !claimed) {
          calendarResults.push({
            id: row.id,
            platform,
            status: "skipped",
            detail: "Already claimed",
          });
          continue;
        }

        try {
          const isVideo = /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(
            claimed.media_url || ""
          );

          const contentType = isVideo
            ? platform === "instagram" || platform === "tiktok"
              ? "reel"
              : "video"
            : "post";

          const { data: contentRow, error: contentErr } = await supabaseAdmin
            .from("content")
            .insert({
              user_id: claimed.user_id,
              workflow_id: null,
              type: contentType,
              title: claimed.caption ? claimed.caption.slice(0, 80) : null,
              caption: claimed.caption,
              hashtags: [],
              image_url: claimed.media_url,
              status: "queued",
              platform,
            })
            .select("id")
            .single();

          if (contentErr || !contentRow) {
            throw new Error(
              contentErr?.message ||
                "Failed to create content for calendar post"
            );
          }

          const batch = await publishAcrossTargetsIsolated({
            supabaseAdmin,
            userId: claimed.user_id,
            contentId: contentRow.id,
            workflowId: null,
            targets: [{ platform, account_id: claimed.account_id }],
          });

          if (batch.succeededCount === 0) {
            throw new Error(batch.errors.join(" | ") || "Calendar publish failed");
          }

          await supabaseAdmin
            .from("content")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
            })
            .eq("id", contentRow.id);

          await supabaseAdmin
            .from("calendar_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", claimed.id);

          calendarResults.push({
            id: claimed.id,
            platform,
            status: "success",
          });
        } catch (err) {
          const message = getErrorMessage(err);

          await supabaseAdmin
            .from("calendar_posts")
            .update({
              status: "failed",
              error_message: message,
            })
            .eq("id", claimed.id);

          calendarResults.push({
            id: claimed.id,
            platform,
            status: "failed",
            detail: message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      dueSlotCount: dueSlots.length,
      results,
      calendarResults,
    });
  } catch (error) {
    console.error("Scheduler run error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Scheduler run failed.",
      },
      { status: 500 }
    );
  }
}

function isAuthReconnectError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("invalid_grant") ||
    m.includes("token refresh failed") ||
    m.includes("reconnect") ||
    m.includes("no refresh_token") ||
    m.includes("oauth") ||
    m.includes("unauthorized") ||
    m.includes("401") ||
    m.includes("190") ||
    m.includes("revoked") ||
    m.includes("expired")
  );
}

async function flagAccountReconnectNeeded(
  supabaseAdmin: SupabaseClient,
  userId: string,
  platform: string,
  accountId: string | null,
  reason: string
) {
  if (!isAuthReconnectError(reason)) return;

  try {
    if (accountId) {
      await supabaseAdmin
        .from("accounts")
        .update({ connected: false })
        .eq("id", accountId)
        .eq("user_id", userId);

      await supabaseAdmin
        .from("accounts")
        .update({ connected: false })
        .eq("user_id", userId)
        .eq("account_id", accountId);
    } else if (platform) {
      await supabaseAdmin
        .from("accounts")
        .update({ connected: false })
        .eq("user_id", userId)
        .ilike("platform", platform);
    }
  } catch (err) {
    console.error("Failed to flag account reconnect state:", err);
  }
}

async function recoverStuckPublishingContent(supabaseAdmin: SupabaseClient) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("content")
    .update({ status: "queued" })
    .eq("status", "publishing")
    .lt("updated_at", fiveMinutesAgo);
}

async function insertRun(
  supabaseAdmin: SupabaseClient,
  run: ScheduleRunInsert
) {
  const { error } = await supabaseAdmin
    .from("workflow_schedule_runs")
    .insert(run);

  if (error) {
    console.error("Failed to insert workflow_schedule_run:", error);
  }
}

import { NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  publishInstagramPost,
  PublishPostError,
} from "@/lib/instagram/publishPost";

/*
 * Publishing a single item can take up to ~24s while polling
 * Instagram's media container status. This route can process
 * multiple due slots in one invocation (sequentially), so this
 * is generous, but still bounded. If many slots ever end up due
 * in the exact same 5-minute window for the same workflow, this
 * may need to move to a queue instead of one synchronous request
 * — fine for the current volume, worth revisiting if that grows.
 */
export const maxDuration = 120;

const WINDOW_MINUTES = 15;

/*
 * Fallback for workflows created before the per-workflow
 * timezone field existed (workflow_settings.timezone is null).
 */
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

function getZonedDayOfWeek(
  date: Date,
  timeZone: string
): number {
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

function getZonedTimeMinutes(
  date: Date,
  timeZone: string
): number {
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

function getZonedDateString(
  date: Date,
  timeZone: string
): string {
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
  if (!settings || !settings.duration_type) {
    return false;
  }

  const { duration_type, end_date } = settings;

  if (duration_type === "unlimited") {
    return false;
  }

  if (duration_type === "custom") {
    if (!end_date) {
      return false;
    }

    return todayDateString > end_date;
  }

  const months = DURATION_MONTHS[duration_type];

  if (!months) {
    return false;
  }

  const start = new Date(createdAt);

  if (Number.isNaN(start.getTime())) {
    return false;
  }

  const expiry = new Date(start);
  expiry.setUTCMonth(expiry.getUTCMonth() + months);

  const today = new Date(`${todayDateString}T00:00:00Z`);

  return today.getTime() > expiry.getTime();
}

/*
 * ================================================================
 * TYPES
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
};

type WorkflowSettingsRow = {
  workflow_id: string;
  duration_type: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
};

/*
 * ================================================================
 * ROUTE
 * ================================================================
 *
 * Triggered externally (GitHub Actions cron) roughly every
 * 5 minutes. Requires:
 *
 *   Authorization: Bearer <CRON_SECRET>
 */

export async function POST(request: Request) {
  return handleScheduler(request);
}

export async function GET(request: Request) {
  return handleScheduler(request);
}

async function handleScheduler(request: Request) {
  /*
   * ------------------------------------------------------------
   * AUTH CHECK
   * ------------------------------------------------------------
   */

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /*
   * ------------------------------------------------------------
   * ENVIRONMENT
   * ------------------------------------------------------------
   */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Server is missing required Supabase configuration.",
      },
      { status: 500 }
    );
  }

  const supabaseAdmin = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const now = new Date();

  const results: Array<{
    scheduleSlotId: string;
    workflowId: string;
    status: string;
    detail?: string;
  }> = [];

  try {
    /*
     * ------------------------------------------------------------
     * LOAD ALL ENABLED SLOTS
     * ------------------------------------------------------------
     *
     * No day_of_week filter here anymore — which calendar day
     * "today" is depends on each workflow's own timezone, so we
     * can't pre-filter by a single global day before knowing
     * that. Day/time matching happens per-slot below instead.
     */

    const { data: slots, error: slotsError } = await supabaseAdmin
      .from("workflow_schedule_slots")
      .select(
        "id, workflow_id, day_of_week, slot_number, post_time, content_type, enabled"
      )
      .eq("enabled", true);

    if (slotsError) {
      console.error("Scheduler slots lookup error:", slotsError);

      return NextResponse.json(
        {
          error:
            slotsError.message ||
            "Unable to load schedule slots.",
        },
        { status: 500 }
      );
    }

    const allSlots: ScheduleSlot[] = slots ?? [];

    if (allSlots.length === 0) {
      return NextResponse.json({
        success: true,
        checkedAt: now.toISOString(),
        dueSlotCount: 0,
        results: [],
      });
    }

    /*
     * ------------------------------------------------------------
     * LOAD WORKFLOWS + SETTINGS FOR ALL WORKFLOWS WITH SLOTS
     * ------------------------------------------------------------
     */

    const workflowIds = Array.from(
      new Set(allSlots.map((slot) => slot.workflow_id))
    );

    const { data: workflows, error: workflowsError } =
      await supabaseAdmin
        .from("workflows")
        .select("id, user_id, active, status, created_at")
        .in("id", workflowIds);

    if (workflowsError) {
      console.error(
        "Scheduler workflows lookup error:",
        workflowsError
      );

      return NextResponse.json(
        {
          error:
            workflowsError.message ||
            "Unable to load workflows.",
        },
        { status: 500 }
      );
    }

    const workflowMap = new Map(
      (workflows ?? []).map((workflow) => [
        workflow.id,
        workflow,
      ])
    );

    const { data: settingsRows, error: settingsError } =
      await supabaseAdmin
        .from("workflow_settings")
        .select(
          "workflow_id, duration_type, start_date, end_date, timezone"
        )
        .in("workflow_id", workflowIds);

    if (settingsError) {
      console.error(
        "Scheduler settings lookup error:",
        settingsError
      );
    }

    const settingsMap = new Map<string, WorkflowSettingsRow>(
      (settingsRows ?? []).map((row) => [
        row.workflow_id,
        row as WorkflowSettingsRow,
      ])
    );

    /*
     * ------------------------------------------------------------
     * DETERMINE WHICH SLOTS ARE ACTUALLY DUE, PER-WORKFLOW TIMEZONE
     * ------------------------------------------------------------
     */

    type DueSlot = {
      slot: ScheduleSlot;
      workflowId: string;
      userId: string;
      timezone: string;
      runDate: string;
    };

        const dueSlots: DueSlot[] = [];

    for (const slot of allSlots) {
      const workflow = workflowMap.get(slot.workflow_id);

      if (!workflow || workflow.active !== true) {
        continue;
      }

      const settings = settingsMap.get(slot.workflow_id);
      const timezone = settings?.timezone || DEFAULT_TIMEZONE;

      const zonedDow = getZonedDayOfWeek(now, timezone);
      const zonedMinutes = getZonedTimeMinutes(now, timezone);

      if (slot.day_of_week !== zonedDow) {
        continue;
      }

      const slotMinutes = timeStringToMinutes(slot.post_time);
      const diff = Math.abs(zonedMinutes - slotMinutes);

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

    /*
     * ------------------------------------------------------------
     * PROCESS EACH DUE WORKFLOW SLOT
     * ------------------------------------------------------------
     * If dueSlots is empty, this loop simply does nothing.
     * Do NOT return early — calendar posts may still be due.
     */

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
          error_message:
            "Workflow duration has ended; workflow deactivated.",
        });

        results.push({
          scheduleSlotId: slot.id,
          workflowId,
          status: "skipped",
          detail: "Workflow duration has ended.",
        });

        continue;
      }

      const { data: existingRun, error: existingRunError } =
        await supabaseAdmin
          .from("workflow_schedule_runs")
          .select("id")
          .eq("schedule_slot_id", slot.id)
          .eq("run_date", runDate)
          .maybeSingle();

      if (existingRunError) {
        console.error(
          "Scheduler existing-run lookup error:",
          existingRunError
        );

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
        console.error(
          "Scheduler content lookup error:",
          queuedContentError
        );

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
          await insertRun(supabaseAdmin, {
            schedule_slot_id: slot.id,
            workflow_id: workflowId,
            run_date: runDate,
            status: "skipped",
            content_id: null,
            error_message: "No queued content available.",
          });

          results.push({
            scheduleSlotId: slot.id,
            workflowId,
            status: "skipped",
            detail: "No queued content available.",
          });

          continue;
        }

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

      const { data: claimedContent, error: claimError } =
        await supabaseAdmin
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
        await publishInstagramPost(userId, claimedContent.id);

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
          error_message: null,
        });

        results.push({
          scheduleSlotId: slot.id,
          workflowId,
          status: "success",
        });
      } catch (publishError) {
        await supabaseAdmin
          .from("content")
          .update({ status: "queued" })
          .eq("id", claimedContent.id);

        const message =
          publishError instanceof PublishPostError ||
          publishError instanceof Error
            ? publishError.message
            : "Unable to publish content.";

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

    /*
     * ------------------------------------------------------------
     * CALENDAR POSTS (Medium plan)
     * ------------------------------------------------------------
     */

    const calendarResults: Array<{
      id: string;
      status: string;
      detail?: string;
    }> = [];

    const { data: calendarRows, error: calendarError } = await supabaseAdmin
      .from("calendar_posts")
      .select(
        "id, user_id, account_id, platform, scheduled_date, scheduled_time, timezone, media_url, caption, status"
      )
      .eq("status", "scheduled")
      .eq("platform", "instagram");

    if (calendarError) {
      console.error("Calendar posts lookup error:", calendarError);
    } else {
      for (const row of calendarRows ?? []) {
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
            status: "skipped",
            detail: "Already claimed",
          });
          continue;
        }

        try {
          const { data: contentRow, error: contentErr } = await supabaseAdmin
            .from("content")
            .insert({
              user_id: row.user_id,
              workflow_id: null,
              type: "post",
              caption: row.caption,
              hashtags: [],
              image_url: row.media_url,
              status: "queued",
              platform: "instagram",
            })
            .select("id")
            .single();

          if (contentErr || !contentRow) {
            throw new Error(
              contentErr?.message ||
                "Failed to create content for calendar post"
            );
          }

          await publishInstagramPost(row.user_id, contentRow.id);

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
            .eq("id", row.id);

          calendarResults.push({ id: row.id, status: "success" });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Calendar publish failed";

          await supabaseAdmin
            .from("calendar_posts")
            .update({
              status: "failed",
              error_message: message,
            })
            .eq("id", row.id);

          calendarResults.push({
            id: row.id,
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
          error instanceof Error
            ? error.message
            : "Scheduler run failed.",
      },
      { status: 500 }
    );
  }
}




/*
 * ================================================================
 * INSERT RUN RECORD
 * ================================================================
 */

async function insertRun(
  supabaseAdmin: SupabaseClient,
  run: ScheduleRunInsert
) {
  const { error } = await supabaseAdmin
    .from("workflow_schedule_runs")
    .insert(run);

  if (error) {
    console.error(
      "Failed to insert workflow_schedule_run:",
      error
    );
  }
}
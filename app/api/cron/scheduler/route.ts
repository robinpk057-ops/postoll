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
 * ================================================================
 * CONFIG
 * ================================================================
 *
 * A slot is only considered "due" if the current UTC time is
 * within this many minutes of its post_time. This matches the
 * external scheduler running roughly every 5 minutes.
 */

const WINDOW_MINUTES = 5;

/*
 * ================================================================
 * TIME HELPERS
 * ================================================================
 */

function getUtcDayOfWeek(date: Date): number {
  // 0 = Sunday ... 6 = Saturday, matches workflow_schedule_slots.day_of_week
  return date.getUTCDay();
}

function getUtcTimeMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
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

function getUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
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
  const todayDow = getUtcDayOfWeek(now);
  const nowMinutes = getUtcTimeMinutes(now);
  const runDate = getUtcDateString(now);

  const results: Array<{
    scheduleSlotId: string;
    workflowId: string;
    status: string;
    detail?: string;
  }> = [];

  try {
    /*
     * ------------------------------------------------------------
     * LOAD TODAY'S ENABLED SLOTS
     * ------------------------------------------------------------
     *
     * Two-step lookup (slots, then workflows) instead of a
     * relational embed, to avoid depending on a specific
     * foreign-key constraint name.
     */

    const { data: slots, error: slotsError } = await supabaseAdmin
      .from("workflow_schedule_slots")
      .select(
        "id, workflow_id, day_of_week, slot_number, post_time, content_type, enabled"
      )
      .eq("day_of_week", todayDow)
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

    const dueSlots: ScheduleSlot[] = (slots ?? []).filter(
      (slot: ScheduleSlot) => {
        const slotMinutes = timeStringToMinutes(slot.post_time);
        const diff = Math.abs(nowMinutes - slotMinutes);

        return diff <= WINDOW_MINUTES;
      }
    );

    if (dueSlots.length === 0) {
      return NextResponse.json({
        success: true,
        checkedAt: now.toISOString(),
        dueSlotCount: 0,
        results: [],
      });
    }

    /*
     * ------------------------------------------------------------
     * LOAD ACTIVE WORKFLOWS FOR THESE SLOTS
     * ------------------------------------------------------------
     */

    const workflowIds = Array.from(
      new Set(dueSlots.map((slot) => slot.workflow_id))
    );

    const { data: workflows, error: workflowsError } =
      await supabaseAdmin
        .from("workflows")
        .select("id, user_id, active, status")
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

    /*
     * ------------------------------------------------------------
     * PROCESS EACH DUE SLOT
     * ------------------------------------------------------------
     */

    for (const slot of dueSlots) {
      const workflow = workflowMap.get(slot.workflow_id);

      if (!workflow || workflow.active !== true) {
        results.push({
          scheduleSlotId: slot.id,
          workflowId: slot.workflow_id,
          status: "skipped",
          detail: "Workflow is not active.",
        });

        continue;
      }

      const workflowId = slot.workflow_id;
      const userId: string = workflow.user_id;

      /*
       * --------------------------------------------------------
       * SKIP IF ALREADY RUN TODAY
       * --------------------------------------------------------
       */

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

      /*
       * --------------------------------------------------------
       * FIND OLDEST QUEUED CONTENT FOR THIS WORKFLOW
       * --------------------------------------------------------
       */

      const { data: queuedContent, error: queuedContentError } =
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

      if (!queuedContent) {
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

      /*
       * --------------------------------------------------------
       * REELS NOT SUPPORTED YET
       * --------------------------------------------------------
       */

      if (queuedContent.type === "reel") {
        await insertRun(supabaseAdmin, {
          schedule_slot_id: slot.id,
          workflow_id: workflowId,
          run_date: runDate,
          status: "failed",
          content_id: queuedContent.id,
          error_message:
            "Reel publishing is not implemented yet.",
        });

        results.push({
          scheduleSlotId: slot.id,
          workflowId,
          status: "failed",
          detail: "Reel publishing is not implemented yet.",
        });

        continue;
      }

      /*
       * --------------------------------------------------------
       * CLAIM THE CONTENT
       * --------------------------------------------------------
       *
       * Prevents two due slots for the same workflow (in the
       * same run) from both picking up and publishing the
       * same content item.
       */

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

      /*
       * --------------------------------------------------------
       * PUBLISH
       * --------------------------------------------------------
       */

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
        /*
         * Revert the claim so this content can be picked up
         * again by a future slot or day.
         */

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

    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      dueSlotCount: dueSlots.length,
      results,
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
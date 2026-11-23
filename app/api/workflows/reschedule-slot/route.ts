import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TIMEZONE = "America/New_York";

function getTomorrowZonedDate(timeZone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now);
  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrowUtc = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + 1));
  return tomorrowUtc.toISOString().slice(0, 10);
}

function normalizeTimeInput(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] || "0");
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) {
    return null;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(
    ss
  ).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const slotId = String(body?.slotId || "").trim();
    const nextPostTime = normalizeTimeInput(String(body?.postTime || ""));

    if (!slotId || !nextPostTime) {
      return NextResponse.json(
        { error: "Valid slotId and postTime (HH:MM) are required." },
        { status: 400 }
      );
    }

    const { data: slot, error: slotErr } = await supabase
      .from("workflow_schedule_slots")
      .select("id, workflow_id, user_id, post_time")
      .eq("id", slotId)
      .maybeSingle();

    if (slotErr || !slot) {
      return NextResponse.json(
        { error: "Schedule slot not found." },
        { status: 404 }
      );
    }

    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, user_id")
      .eq("id", slot.workflow_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!workflow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: settings } = await supabase
      .from("workflow_settings")
      .select("timezone")
      .eq("workflow_id", slot.workflow_id)
      .maybeSingle();

    const tz = settings?.timezone || DEFAULT_TIMEZONE;
    const effectiveFromDate = getTomorrowZonedDate(tz);

    const { data: updated, error: updateErr } = await supabase
      .from("workflow_schedule_slots")
      .update({
        pending_post_time: nextPostTime,
        effective_from_date: effectiveFromDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slotId)
      .select("id, post_time, pending_post_time, effective_from_date")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to schedule next-day time." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      slot: updated,
      message: `New schedule (${nextPostTime.slice(
        0,
        5
      )}) will happen from tomorrow onwards (${effectiveFromDate}). Today's post will still run at ${String(
        slot.post_time
      ).slice(0, 5)}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getNextSlotDate(dayOfWeek: number, postTime: string, now: Date): Date {
  const [hh, mm, ss] = String(postTime || "10:00:00").split(":").map(Number);
  const candidate = new Date(now);
  candidate.setHours(hh || 10, mm || 0, ss || 0, 0);
  const diffDays = (dayOfWeek - now.getDay() + 7) % 7;
  candidate.setDate(now.getDate() + diffDays);
  if (diffDays === 0 && candidate.getTime() < now.getTime() - 60_000) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);

  const { data: slots, error } = await supabase
    .from("workflow_schedule_slots")
    .select("id, workflow_id, user_id, day_of_week, post_time, enabled")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueSlots = (slots || []).filter((slot) => {
    const slotDt = getNextSlotDate(Number(slot.day_of_week), String(slot.post_time), now);
    return slotDt.getTime() >= now.getTime() && slotDt.getTime() <= thirtyMinsLater.getTime();
  });

  const triggered: string[] = [];
  const origin = req.nextUrl.origin;

  for (const slot of dueSlots) {
    const runDate = now.toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("workflow_id", slot.workflow_id)
      .eq("run_date", runDate)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const res = await fetch(`${origin}/api/ai-director/run-daily`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        workflowId: slot.workflow_id,
        runDate,
        scheduledForLeadMinutes: 30,
      }),
    });

    if (res.ok) {
      triggered.push(slot.id);
    }
  }

  return NextResponse.json({
    ok: true,
    windowMinutes: 30,
    checkedSlots: (slots || []).length,
    triggeredCount: triggered.length,
    triggeredSlotIds: triggered,
  });
}
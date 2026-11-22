import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BLOCKED_PLATFORMS = new Set(["x", "twitter"]);
const PUBLISHED_STATUSES = new Set([
  "published",
  "posted",
  "completed",
  "success",
]);

function isPublishedStatus(status: string | null | undefined): boolean {
  return PUBLISHED_STATUSES.has((status || "").trim().toLowerCase());
}

function getNowInTimeZone(timeZone: string): { dateKey: string; timeStr: string } {
  const safeTz = timeZone || "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    const hour = map.hour === "24" ? "00" : map.hour || "00";
    return {
      dateKey: `${map.year}-${map.month}-${map.day}`,
      timeStr: `${hour}:${map.minute || "00"}:${map.second || "00"}`,
    };
  } catch {
    const now = new Date();
    return {
      dateKey: now.toISOString().slice(0, 10),
      timeStr: now.toISOString().slice(11, 19),
    };
  }
}

function addMinutesToTimeStr(timeStr: string, minsToAdd: number): string {
  const [h = 0, m = 0, s = 0] = timeStr.split(":").map(Number);
  const totalMinutes = Math.min(23 * 60 + 59, h * 60 + m + minsToAdd);
  const nh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const nm = String(totalMinutes % 60).padStart(2, "0");
  const ns = String(Number.isFinite(s) ? s : 0).padStart(2, "0");
  return `${nh}:${nm}:${ns}`;
}

function normalizeTimeStr(raw: string): string {
  const parts = raw.split(":");
  const hh = String(Math.min(23, Math.max(0, Number(parts[0] ?? 9)))).padStart(
    2,
    "0"
  );
  const mm = String(Math.min(59, Math.max(0, Number(parts[1] ?? 0)))).padStart(
    2,
    "0"
  );
  const ss = String(Math.min(59, Math.max(0, Number(parts[2] ?? 0)))).padStart(
    2,
    "0"
  );
  return `${hh}:${mm}:${ss}`;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: accountsList } = await supabase
      .from("accounts")
      .select("id, platform, account_name")
      .eq("user_id", user.id);

    const accountMap = new Map<
      string,
      { account_name: string | null; platform: string | null }
    >();
    for (const acc of accountsList || []) {
      accountMap.set(acc.id, {
        account_name: acc.account_name ?? null,
        platform: acc.platform ?? null,
      });
    }

    const { data, error } = await supabase
      .from("calendar_posts")
      .select(
        "id, platform, scheduled_date, scheduled_time, timezone, media_url, thumbnail_url, caption, status, account_id, published_at, created_at"
      )
      .eq("user_id", user.id)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false })
      .limit(300);

    if (error) {
      console.error("calendar GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (data ?? []).map((row) => {
      const accInfo = row.account_id
        ? accountMap.get(row.account_id)
        : undefined;
      return {
        ...row,
        account_name: accInfo?.account_name || row.platform || "Account",
      };
    });

    return NextResponse.json({ posts: enriched });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      scheduled_date,
      scheduled_time,
      timezone,
      media_url,
      thumbnail_url,
      caption,
      account_id,
      platform,
    } = body;

    if (!scheduled_date || !scheduled_time || !media_url) {
      return NextResponse.json(
        { error: "scheduled_date, scheduled_time and media_url are required" },
        { status: 400 }
      );
    }

    let resolvedAccountId: string | null = account_id || null;
    let resolvedPlatform: string = (platform || "").toLowerCase();
    let resolvedAccountName: string | null = null;

    if (resolvedAccountId) {
      const { data: selectedAcc } = await supabase
        .from("accounts")
        .select("id, platform, account_name, connected")
        .eq("id", resolvedAccountId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!selectedAcc) {
        return NextResponse.json(
          { error: "Selected account not found." },
          { status: 404 }
        );
      }

      const accPlatform = (selectedAcc.platform || "").toLowerCase();
      if (BLOCKED_PLATFORMS.has(accPlatform)) {
        return NextResponse.json(
          { error: "Scheduling to X is not supported." },
          { status: 400 }
        );
      }

      resolvedPlatform = accPlatform || resolvedPlatform || "instagram";
      resolvedAccountName = selectedAcc.account_name ?? null;
    } else {
      const { data: fallbackAcc } = await supabase
        .from("accounts")
        .select("id, platform, account_name, connected")
        .eq("user_id", user.id)
        .eq("connected", true);

      const eligible = (fallbackAcc || []).find(
        (a) => !BLOCKED_PLATFORMS.has((a.platform || "").toLowerCase())
      );

      if (!eligible) {
        return NextResponse.json(
          { error: "Connect an eligible social account first." },
          { status: 400 }
        );
      }

      resolvedAccountId = eligible.id;
      resolvedPlatform = (eligible.platform || "instagram").toLowerCase();
      resolvedAccountName = eligible.account_name ?? null;
    }

    const effectiveTz = timezone || "UTC";
    const normalizedRequestedTime = normalizeTimeStr(scheduled_time);
    const nowInTz = getNowInTimeZone(effectiveTz);

    let finalTime = normalizedRequestedTime;
    let adjustedFromPastTime = false;

    if (
      scheduled_date === nowInTz.dateKey &&
      normalizedRequestedTime < nowInTz.timeStr
    ) {
      finalTime = addMinutesToTimeStr(nowInTz.timeStr, 5);
      adjustedFromPastTime = true;
    }

    const { data, error } = await supabase
      .from("calendar_posts")
      .insert({
        user_id: user.id,
        account_id: resolvedAccountId,
        platform: resolvedPlatform,
        scheduled_date,
        scheduled_time: finalTime,
        timezone: effectiveTz,
        media_url,
        thumbnail_url: thumbnail_url || null,
        caption: caption || null,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) {
      console.error("calendar POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      post: {
        ...data,
        account_name: resolvedAccountName || resolvedPlatform,
      },
      adjustedFromPastTime,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Post id is required" }, { status: 400 });
    }

    const { data: targetPost, error: fetchErr } = await supabase
      .from("calendar_posts")
      .select("id, scheduled_date, platform, account_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!targetPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (isPublishedStatus(targetPost.status)) {
      return NextResponse.json(
        {
          error:
            "This post has already been published and cannot be deleted or rescheduled.",
        },
        { status: 400 }
      );
    }

    // Check if content has already been posted for the same platform/account on that day
    const { data: dayRows } = await supabase
      .from("calendar_posts")
      .select("id, platform, account_id, status")
      .eq("user_id", user.id)
      .eq("scheduled_date", targetPost.scheduled_date);

    const alreadyPostedSamePlatformDay = (dayRows || []).some((r) => {
      if (!isPublishedStatus(r.status)) return false;
      const sameAccount =
        targetPost.account_id && r.account_id === targetPost.account_id;
      const samePlatform =
        targetPost.platform &&
        (r.platform || "").toLowerCase() ===
          (targetPost.platform || "").toLowerCase();
      return Boolean(sameAccount || samePlatform);
    });

    if (alreadyPostedSamePlatformDay) {
      return NextResponse.json(
        {
          error:
            "Content has already been posted for this platform on this day; delete/reschedule is locked.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("calendar_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("calendar DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
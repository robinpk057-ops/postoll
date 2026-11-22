import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BLOCKED_PLATFORMS = new Set(["x", "twitter"]);

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

    const today = new Date();
    const start = today.toISOString().slice(0, 10);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 29);
    const end = endDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("calendar_posts")
      .select(
        "id, platform, scheduled_date, scheduled_time, timezone, media_url, thumbnail_url, caption, status, account_id, published_at, created_at"
      )
      .eq("user_id", user.id)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true });

    if (error) {
      console.error("calendar GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data ?? [] });
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

    if (resolvedAccountId) {
      const { data: selectedAcc } = await supabase
        .from("accounts")
        .select("id, platform, connected")
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
    } else {
      const { data: fallbackAcc } = await supabase
        .from("accounts")
        .select("id, platform, connected")
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
    }

    const { data, error } = await supabase
      .from("calendar_posts")
      .insert({
        user_id: user.id,
        account_id: resolvedAccountId,
        platform: resolvedPlatform,
        scheduled_date,
        scheduled_time,
        timezone: timezone || "UTC",
        media_url,
        caption: caption || null,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) {
      console.error("calendar POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
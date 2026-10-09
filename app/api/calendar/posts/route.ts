import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      platform = "instagram",
    } = body;

    if (!scheduled_date || !scheduled_time || !media_url) {
      return NextResponse.json(
        { error: "scheduled_date, scheduled_time and media_url are required" },
        { status: 400 }
      );
    }

    let resolvedAccountId = account_id as string | null;

    if (!resolvedAccountId) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", "instagram")
        .eq("connected", true)
        .limit(1)
        .maybeSingle();

      resolvedAccountId = acc?.id ?? null;
    }

    if (!resolvedAccountId) {
      return NextResponse.json(
        { error: "Connect an Instagram account first." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("calendar_posts")
      .insert({
        user_id: user.id,
        account_id: resolvedAccountId,
        platform,
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
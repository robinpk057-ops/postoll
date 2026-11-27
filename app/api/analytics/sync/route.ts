import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getPlanConfig } from "@/lib/plans";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleAnalyticsSync(req);
}

export async function GET(req: NextRequest) {
  return handleAnalyticsSync(req);
}

async function handleAnalyticsSync(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service configuration missing." },
        { status: 500 }
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    let targetUserId: string | null = null;
    if (!isCron) {
      const sessionSupabase = await createSessionClient();
      const {
        data: { user },
      } = await sessionSupabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      targetUserId = user.id;
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Determine eligible Growth users
    let profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, plan_tier")
      .eq("plan_tier", "growth");

    if (targetUserId) {
      profileQuery = profileQuery.eq("id", targetUserId);
    }

    const { data: growthProfiles, error: profErr } = await profileQuery;
    if (profErr) {
      throw new Error(profErr.message);
    }

    if (!growthProfiles || growthProfiles.length === 0) {
      if (targetUserId) {
        const plan = getPlanConfig("scheduler");
        return NextResponse.json(
          {
            error: `Analytics ingestion requires the Growth plan (current default: ${plan.name}).`,
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ ok: true, syncedRows: 0, usersChecked: 0 });
    }

    const userIds = growthProfiles.map((p) => p.id);
    const metricDate = new Date().toISOString().slice(0, 10);

    // Fetch recent published content for Growth users
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: publishedPosts, error: postsErr } = await supabaseAdmin
      .from("content")
      .select(
        "id, user_id, workflow_id, platform, platform_post_id, published_at, status"
      )
      .in("user_id", userIds)
      .eq("status", "published")
      .gte("published_at", thirtyDaysAgo);

    if (postsErr) {
      throw new Error(postsErr.message);
    }

    const posts = publishedPosts ?? [];
    if (posts.length === 0) {
      return NextResponse.json({
        ok: true,
        syncedRows: 0,
        usersChecked: userIds.length,
      });
    }

    // Load connected accounts for token lookups
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("id, user_id, platform, account_id, access_token, connected")
      .in("user_id", userIds)
      .eq("connected", true);

    const accountByUserPlatform = new Map<
      string,
      { access_token: string; account_id: string }
    >();
    for (const acc of accounts ?? []) {
      const key = `${acc.user_id}:${String(acc.platform).toLowerCase()}`;
      if (!accountByUserPlatform.has(key) && acc.access_token) {
        accountByUserPlatform.set(key, {
          access_token: acc.access_token,
          account_id: acc.account_id,
        });
      }
    }

    let syncedRows = 0;

    for (const post of posts) {
      const platform = String(post.platform || "instagram").toLowerCase();
      const creds = accountByUserPlatform.get(`${post.user_id}:${platform}`);

      let views = 0;
      let reach = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;

      // Attempt live platform metric fetch when platform_post_id & access_token exist
      if (creds?.access_token && post.platform_post_id) {
        try {
          if (platform === "youtube") {
            const ytRes = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(
                post.platform_post_id
              )}`,
              {
                headers: { Authorization: `Bearer ${creds.access_token}` },
                cache: "no-store",
              }
            );
            const ytJson = await ytRes.json();
            const stats = ytJson?.items?.[0]?.statistics;
            if (stats) {
              views = Number(stats.viewCount || 0);
              reach = views;
              likes = Number(stats.likeCount || 0);
              comments = Number(stats.commentCount || 0);
            }
          } else if (platform === "instagram") {
            const igRes = await fetch(
              `https://graph.instagram.com/${encodeURIComponent(
                post.platform_post_id
              )}?fields=like_count,comments_count&access_token=${encodeURIComponent(
                creds.access_token
              )}`,
              { cache: "no-store" }
            );
            const igJson = await igRes.json();
            if (igRes.ok) {
              likes = Number(igJson.like_count || 0);
              comments = Number(igJson.comments_count || 0);
            }
          } else if (platform === "facebook") {
            const fbRes = await fetch(
              `https://graph.facebook.com/v21.0/${encodeURIComponent(
                post.platform_post_id
              )}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(
                creds.access_token
              )}`,
              { cache: "no-store" }
            );
            const fbJson = await fbRes.json();
            if (fbRes.ok) {
              likes = Number(fbJson?.likes?.summary?.total_count || 0);
              comments = Number(fbJson?.comments?.summary?.total_count || 0);
              shares = Number(fbJson?.shares?.count || 0);
            }
          }
        } catch (fetchErr) {
          console.warn(`Metrics fetch warning for ${platform}:`, fetchErr);
        }
      }

      const { error: upsertErr } = await supabaseAdmin
        .from("post_metrics_daily")
        .upsert(
          {
            user_id: post.user_id,
            workflow_id: post.workflow_id,
            content_id: post.id,
            platform,
            metric_date: metricDate,
            views,
            reach,
            likes,
            comments,
            shares,
          },
          { onConflict: "content_id,platform,metric_date" }
        );

      if (!upsertErr) {
        syncedRows++;
      }
    }

    return NextResponse.json({
      ok: true,
      metricDate,
      usersChecked: userIds.length,
      syncedRows,
    });
  } catch (err) {
    console.error("[/api/analytics/sync] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Analytics sync failed.",
      },
      { status: 500 }
    );
  }
}

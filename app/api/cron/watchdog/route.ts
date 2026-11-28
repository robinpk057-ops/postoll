import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { WatchdogIncidentDraft, WatchdogRunReport } from "@/lib/watchdog/types";
import { sendWatchdogAlertEmail } from "@/lib/watchdog/mailer";
import { enforceExpiredSubscriptions } from "@/lib/billing/ledger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAIL_COOLDOWN_MS = 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function getReadOnlyAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runGeminiTriage(
  incidents: WatchdogIncidentDraft[]
): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey || incidents.length === 0) return null;

  const compactPayload = incidents.map((i) => ({
    severity: i.severity,
    category: i.category,
    title: i.title,
    summary: i.summary,
    area: i.affectedRouteOrFeature,
  }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key=${encodeURIComponent(
        geminiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "You are Postoll's read-only reliability analyst. Given these sanitized system health incidents, write a concise 3-bullet executive diagnosis and priority order for the developer. Do not invent data.\n\n" +
                    JSON.stringify(compactPayload),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 350,
          },
        }),
      }
    );

    if (!res.ok) return null;
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function handleWatchdog(req: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getReadOnlyAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables missing" },
      { status: 500 }
    );
  }

  const incidents: WatchdogIncidentDraft[] = [];
  await enforceExpiredSubscriptions();
  const checksRun: string[] = [];
  const warnings: string[] = [];
  const now = new Date();

  checksRun.push("oauth_token_expiry");
  try {
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: expiringAccounts, error } = await supabase
      .from("accounts")
      .select("id, platform, expires_at")
      .not("expires_at", "is", null)
      .lt("expires_at", in24h)
      .limit(50);

    if (error) {
      warnings.push(`accounts check skipped: ${error.message}`);
    } else if (expiringAccounts && expiringAccounts.length > 0) {
      const platforms = Array.from(
        new Set(expiringAccounts.map((a) => a.platform || "unknown"))
      ).join(", ");
      incidents.push({
        fingerprint: `oauth_token:expiring_${platforms.replace(/\s+/g, "_")}`,
        source: "watchdog_probe",
        severity: "warning",
        category: "oauth_token",
        title: `${expiringAccounts.length} social account token(s) expired or expiring within 24h`,
        summary: `Connected account tokens on (${platforms}) are expired or expiring within 24 hours, which can cause scheduled posts to fail.`,
        recommendedAction:
          "Verify automatic refresh token cron/logic or prompt affected users on /accounts to reconnect.",
        affectedRouteOrFeature: "/accounts",
      });
    }
  } catch (e) {
    warnings.push(`oauth_token_expiry error: ${e instanceof Error ? e.message : "unknown"}`);
  }

  checksRun.push("overdue_scheduled_content");
  try {
    const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
    const { data: overdueRows, error } = await supabase
      .from("content")
      .select("id, status, schedule_status, scheduled_at")
      .in("status", ["queued", "scheduled"])
      .not("scheduled_at", "is", null)
      .lt("scheduled_at", twentyMinsAgo)
      .limit(50);

    if (error) {
      warnings.push(`content overdue check skipped: ${error.message}`);
    } else if (overdueRows && overdueRows.length > 0) {
      incidents.push({
        fingerprint: "publishing:overdue_queued_content",
        source: "watchdog_probe",
        severity: "critical",
        category: "publishing",
        title: `${overdueRows.length} scheduled post(s) overdue by more than 20 minutes`,
        summary: `Found ${overdueRows.length} content item(s) still in queued/scheduled state past their scheduled_at timestamp.`,
        recommendedAction:
          "Check external cron runner (cron-job.org / GitHub Actions) calling /api/cron/scheduler and inspect active workflow limits.",
        affectedRouteOrFeature: "/api/cron/scheduler",
      });
    }
  } catch (e) {
    warnings.push(`overdue_scheduled_content error: ${e instanceof Error ? e.message : "unknown"}`);
  }

  checksRun.push("recent_failed_runs");
  try {
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const { data: failedRuns, error } = await supabase
      .from("workflow_schedule_runs")
      .select("id, status, error_message, created_at")
      .eq("status", "failed")
      .gte("created_at", thirtyMinsAgo)
      .limit(50);

    if (error) {
      warnings.push(`workflow_schedule_runs check skipped: ${error.message}`);
    } else if (failedRuns && failedRuns.length > 0) {
      incidents.push({
        fingerprint: "publishing:recent_schedule_run_failures",
        source: "watchdog_probe",
        severity: "critical",
        category: "publishing",
        title: `${failedRuns.length} workflow schedule run(s) failed in the last 30 minutes`,
        summary: `Recent scheduled publishing runs recorded status='failed'. Sample reason: ${
          failedRuns[0]?.error_message || "No error message recorded"
        }.`,
        recommendedAction:
          "Inspect workflow_schedule_runs error_message and verify platform API quotas and media formats.",
        affectedRouteOrFeature: "/workflows",
      });
    }
  } catch (e) {
    warnings.push(`recent_failed_runs error: ${e instanceof Error ? e.message : "unknown"}`);
  }

  checksRun.push("public_route_health");
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (baseUrl) {
    for (const path of ["/", "/plans"]) {
      try {
        const routeRes = await fetch(`${baseUrl}${path}`, {
          method: "HEAD",
          cache: "no-store",
        });
        if (routeRes.status >= 500) {
          incidents.push({
            fingerprint: `frontend_route:http_${routeRes.status}_${path}`,
            source: "watchdog_probe",
            severity: "critical",
            category: "frontend_route",
            title: `Route ${path} returned HTTP ${routeRes.status}`,
            summary: `Synthetic health check against ${baseUrl}${path} failed with HTTP ${routeRes.status}.`,
            recommendedAction: `Check Vercel deployment logs for ${path}.`,
            affectedRouteOrFeature: path,
          });
        }
      } catch {
        warnings.push(`Route probe skipped for ${path}`);
      }
    }
  }

  const aiTriageSummary = await runGeminiTriage(incidents);
  let emailedCount = 0;

  for (const incident of incidents) {
    let shouldSendEmail = incident.severity !== "info";
    let occurrenceCount = 1;

    try {
      const { data: existing, error: lookupErr } = await supabase
        .from("watchdog_incidents")
        .select("id, occurrence_count, email_sent_at, status")
        .eq("fingerprint", incident.fingerprint)
        .eq("status", "open")
        .maybeSingle();

      if (!lookupErr) {
        if (existing) {
          occurrenceCount = (existing.occurrence_count || 1) + 1;
          const lastEmailed = existing.email_sent_at
            ? new Date(existing.email_sent_at).getTime()
            : 0;
          shouldSendEmail =
            incident.severity !== "info" &&
            now.getTime() - lastEmailed > EMAIL_COOLDOWN_MS;

          await supabase
            .from("watchdog_incidents")
            .update({
              occurrence_count: occurrenceCount,
              last_seen_at: now.toISOString(),
              summary: incident.summary,
              ...(shouldSendEmail ? { email_sent_at: now.toISOString() } : {}),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("watchdog_incidents").insert({
            fingerprint: incident.fingerprint,
            source: incident.source,
            severity: incident.severity,
            category: incident.category,
            title: incident.title,
            summary: incident.summary,
            recommended_action: incident.recommendedAction,
            affected_route_or_feature: incident.affectedRouteOrFeature || null,
            affected_user_id: incident.affectedUserId || null,
            occurrence_count: 1,
            status: "open",
            email_sent_at: shouldSendEmail ? now.toISOString() : null,
            last_seen_at: now.toISOString(),
          });
        }
      } else {
        warnings.push(
          `watchdog_incidents error: ${lookupErr.message}`
        );
      }
    } catch {
      warnings.push("watchdog_incidents persistence skipped.");
    }

    if (shouldSendEmail) {
      const mailResult = await sendWatchdogAlertEmail(
        aiTriageSummary
          ? {
              ...incident,
              recommendedAction: `${incident.recommendedAction}\n\nAI Triage:\n${aiTriageSummary}`,
            }
          : incident,
        { occurrenceCount }
      );
      if (mailResult.sent) {
        emailedCount += 1;
      } else if (mailResult.skippedReason) {
        warnings.push(mailResult.skippedReason);
      }
    }
  }

  const heartbeatUrl = process.env.WATCHDOG_HEARTBEAT_URL?.trim();
  if (heartbeatUrl) {
    await fetch(heartbeatUrl, { method: "GET", cache: "no-store" }).catch(() => {});
  }

  const report: WatchdogRunReport = {
    ok: true,
    checkedAt: now.toISOString(),
    durationMs: Date.now() - startedAt,
    checksRun,
    detectedCount: incidents.length,
    emailedCount,
    incidents,
    aiTriageSummary,
    warnings,
  };

  return NextResponse.json(report, { status: 200 });
}

export async function GET(req: NextRequest) {
  return handleWatchdog(req);
}

export async function POST(req: NextRequest) {
  return handleWatchdog(req);
}

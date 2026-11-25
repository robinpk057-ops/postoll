import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  verifyAdminRequest,
} from "@/lib/security/guards";

export async function GET() {
  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = createServiceRoleClient() ?? (await createClient());

  const [profilesRes, apiLogsRes, webhooksRes, auditRes] = await Promise.all([
    db
      .from("profiles")
      .select("id, email, full_name, username, credits, is_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("api_usage_logs")
      .select(
        "id, user_id, provider, endpoint, status, credits_charged, estimated_cost_usd, error_message, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("payment_webhook_events")
      .select("id, provider, event_id, event_type, status, processed_at")
      .order("processed_at", { ascending: false })
      .limit(100),
    db
      .from("admin_audit_logs")
      .select("id, actor_user_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const users = profilesRes.data ?? [];
  const apiLogs = apiLogsRes.data ?? [];
  const webhooks = webhooksRes.data ?? [];
  const auditLogs = auditRes.data ?? [];

  let totalApiCostUsd = 0;
  let totalCreditsCharged = 0;
  let errorCount = 0;

  for (const row of apiLogs) {
    const cost = Number(row.estimated_cost_usd ?? 0);
    if (Number.isFinite(cost)) totalApiCostUsd += cost;
    const credits = Number(row.credits_charged ?? 0);
    if (Number.isFinite(credits)) totalCreditsCharged += credits;
    if (String(row.status).toLowerCase() === "error") errorCount += 1;
  }

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      totalApiCalls: apiLogs.length,
      errorCount,
      totalApiCostUsd: Number(totalApiCostUsd.toFixed(5)),
      totalCreditsCharged,
      webhookEventsCount: webhooks.length,
    },
    users,
    apiLogs,
    webhooks,
    auditLogs,
    warnings: {
      missingServiceRoleKey: !process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}

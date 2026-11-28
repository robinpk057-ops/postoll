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

  const [profilesRes, apiLogsRes, webhooksRes, auditRes, subsRes, txRes] =
    await Promise.all([
      db
        .from("profiles")
        .select(
          "id, email, full_name, username, credits, plan_tier, plan_status, plan_started_at, plan_ends_at, is_admin, created_at"
        )
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
      db
        .from("subscriptions")
        .select(
          "id, user_id, provider, provider_subscription_id, plan_tier, billing_cycle, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, paused_at, last_payment_at, updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      db
        .from("billing_transactions")
        .select(
          "id, user_id, subscription_id, provider, provider_event_id, provider_invoice_id, event_kind, plan_tier, billing_cycle, amount_cents, tax_cents, currency, status, invoice_number, hosted_invoice_url, invoice_pdf_url, customer_name, customer_email, description, period_start, period_end, occurred_at"
        )
        .order("occurred_at", { ascending: false })
        .limit(300),
    ]);

  const users = profilesRes.data ?? [];
  const apiLogs = apiLogsRes.data ?? [];
  const webhooks = webhooksRes.data ?? [];
  const auditLogs = auditRes.data ?? [];
  const subscriptions = subsRes.data ?? [];
  const billingTransactions = txRes.data ?? [];

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

  let totalRevenueCents = 0;
  for (const tx of billingTransactions) {
    if (tx.status === "paid" || tx.status === "refunded") {
      const amt = Number(tx.amount_cents ?? 0);
      if (Number.isFinite(amt)) totalRevenueCents += amt;
    }
  }

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      totalApiCalls: apiLogs.length,
      errorCount,
      totalApiCostUsd: Number(totalApiCostUsd.toFixed(5)),
      totalCreditsCharged,
      webhookEventsCount: webhooks.length,
      activeSubscriptionsCount: subscriptions.filter((s) => s.status === "active").length,
      totalRevenueUsd: Number((totalRevenueCents / 100).toFixed(2)),
    },
    users,
    apiLogs,
    webhooks,
    auditLogs,
    subscriptions,
    billingTransactions,
    warnings: {
      missingServiceRoleKey: !process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}
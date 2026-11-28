import "server-only";

import { createServiceRoleClient } from "@/lib/security/guards";
import { PLAN_CONFIGS, getPlanConfig, type PlanTier } from "@/lib/plans";

export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired" | "paused";
export type BillingEventKind =
  | "checkout_paid"
  | "renewal_paid"
  | "upgraded"
  | "downgraded"
  | "canceled"
  | "payment_failed"
  | "paused_expired"
  | "refunded";

export interface BillingTransactionInput {
  userId: string;
  subscriptionId?: string | null;
  provider: "stripe" | "razorpay" | "system";
  providerEventId: string;
  providerInvoiceId?: string | null;
  providerPaymentIntentId?: string | null;
  providerSubscriptionId?: string | null;
  eventKind: BillingEventKind;
  planTier: PlanTier;
  billingCycle: BillingCycle;
  amountCents: number;
  taxCents?: number;
  currency?: string;
  status: "paid" | "failed" | "pending" | "refunded" | "recorded";
  invoiceNumber?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  billingDetails?: Record<string, unknown>;
  description?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  occurredAt?: string;
}

const STRIPE_PRICE_ENV_MAP: Record<PlanTier, Record<BillingCycle, string>> = {
  scheduler: {
    monthly: "STRIPE_PRICE_SCHEDULER_MONTHLY",
    yearly: "STRIPE_PRICE_SCHEDULER_YEARLY",
  },
  scheduler_pro: {
    monthly: "STRIPE_PRICE_SCHEDULER_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_SCHEDULER_PRO_YEARLY",
  },
  creator: {
    monthly: "STRIPE_PRICE_CREATOR_MONTHLY",
    yearly: "STRIPE_PRICE_CREATOR_YEARLY",
  },
  growth: {
    monthly: "STRIPE_PRICE_GROWTH_MONTHLY",
    yearly: "STRIPE_PRICE_GROWTH_YEARLY",
  },
};

export function getStripePriceId(planTier: PlanTier, billingCycle: BillingCycle): string | null {
  const envKey = STRIPE_PRICE_ENV_MAP[planTier]?.[billingCycle];
  if (!envKey) return null;
  const val = process.env[envKey]?.trim();
  return val && val.length > 0 ? val : null;
}

export function resolvePlanFromStripePriceId(priceId?: string | null): {
  planTier: PlanTier;
  billingCycle: BillingCycle;
} | null {
  if (!priceId) return null;
  for (const tier of Object.keys(STRIPE_PRICE_ENV_MAP) as PlanTier[]) {
    for (const cycle of ["monthly", "yearly"] as BillingCycle[]) {
      const envVal = process.env[STRIPE_PRICE_ENV_MAP[tier][cycle]]?.trim();
      if (envVal && envVal === priceId) {
        return { planTier: tier, billingCycle: cycle };
      }
    }
  }
  return null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBillingReceiptEmail(params: {
  toEmail: string;
  customerName?: string | null;
  planName: string;
  billingCycle: BillingCycle;
  eventKind: BillingEventKind;
  amountCents: number;
  currency: string;
  invoiceNumber?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !params.toEmail) return;

  const fromEmail =
    process.env.BILLING_FROM_EMAIL?.trim() ||
    process.env.WATCHDOG_FROM_EMAIL?.trim() ||
    "Postoll Billing <onboarding@resend.dev>";

  const formattedAmount = `${(params.amountCents / 100).toFixed(2)} ${params.currency.toUpperCase()}`;
  const subject =
    params.eventKind === "payment_failed"
      ? `[Postoll] Action Required: Payment Failed for ${params.planName}`
      : `[Postoll] Billing Receipt & Invoice — ${params.planName} (${formattedAmount})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px; color: #111827;">
      <h2 style="margin: 0 0 8px;">Postoll Billing Update</h2>
      <p style="margin: 0 0 16px; color: #4b5563;">Hi ${escapeHtml(params.customerName || "there")},</p>
      <p style="margin: 0 0 16px;">Event: <strong>${escapeHtml(params.eventKind.replace("_", " ").toUpperCase())}</strong> &bull; Plan: <strong>${escapeHtml(params.planName)}</strong> (${escapeHtml(params.billingCycle)})</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Amount</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${escapeHtml(formattedAmount)}</td></tr>
        ${params.invoiceNumber ? `<tr><td style="padding: 6px 0; color: #6b7280;">Invoice #</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(params.invoiceNumber)}</td></tr>` : ""}
        ${params.periodStart ? `<tr><td style="padding: 6px 0; color: #6b7280;">Period Start</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(new Date(params.periodStart).toLocaleDateString("en-US", { dateStyle: "medium" }))}</td></tr>` : ""}
        ${params.periodEnd ? `<tr><td style="padding: 6px 0; color: #6b7280;">Period End / Renewal</td><td style="padding: 6px 0; text-align: right;">${escapeHtml(new Date(params.periodEnd).toLocaleDateString("en-US", { dateStyle: "medium" }))}</td></tr>` : ""}
      </table>
      ${
        params.hostedInvoiceUrl || params.invoicePdfUrl
          ? `<p style="margin: 0 0 16px;">
              ${params.hostedInvoiceUrl ? `<a href="${escapeHtml(params.hostedInvoiceUrl)}" style="margin-right: 14px; color: #2563eb;">View Hosted Invoice</a>` : ""}
              ${params.invoicePdfUrl ? `<a href="${escapeHtml(params.invoicePdfUrl)}" style="color: #2563eb;">Download Invoice PDF</a>` : ""}
            </p>`
          : ""
      }
      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">You can view your full billing history and manage your subscription anytime in Postoll Settings.</p>
    </div>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject,
        html,
      }),
    });
  } catch {
    // Non-blocking email failure
  }
}

export async function pauseExcessWorkflowsForUser(
  userId: string,
  planTier: PlanTier
): Promise<number> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) return 0;

  const cap = getPlanConfig(planTier).maxWorkflows;
  const { data: activeWorkflows, error } = await adminDb
    .from("workflows")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error || !activeWorkflows || activeWorkflows.length <= cap) {
    return 0;
  }

  const toPauseIds = activeWorkflows.slice(cap).map((w) => w.id);
  if (toPauseIds.length === 0) return 0;

  const { error: updateErr } = await adminDb
    .from("workflows")
    .update({ active: false })
    .in("id", toPauseIds);

  return updateErr ? 0 : toPauseIds.length;
}

export async function recordBillingTransaction(
  tx: BillingTransactionInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    return { ok: false, error: "Service role client unavailable" };
  }

  const { data, error } = await adminDb
    .from("billing_transactions")
    .upsert(
      {
        user_id: tx.userId,
        subscription_id: tx.subscriptionId ?? null,
        provider: tx.provider,
        provider_event_id: tx.providerEventId,
        provider_invoice_id: tx.providerInvoiceId ?? null,
        provider_payment_intent_id: tx.providerPaymentIntentId ?? null,
        provider_subscription_id: tx.providerSubscriptionId ?? null,
        event_kind: tx.eventKind,
        plan_tier: tx.planTier,
        billing_cycle: tx.billingCycle,
        amount_cents: Math.round(tx.amountCents),
        tax_cents: Math.round(tx.taxCents ?? 0),
        currency: (tx.currency || "usd").toLowerCase(),
        status: tx.status,
        invoice_number: tx.invoiceNumber ?? null,
        hosted_invoice_url: tx.hostedInvoiceUrl ?? null,
        invoice_pdf_url: tx.invoicePdfUrl ?? null,
        customer_name: tx.customerName ?? null,
        customer_email: tx.customerEmail ?? null,
        billing_details: tx.billingDetails ?? {},
        description: tx.description ?? null,
        period_start: tx.periodStart ?? null,
        period_end: tx.periodEnd ?? null,
        occurred_at: tx.occurredAt ?? new Date().toISOString(),
      },
      { onConflict: "provider_event_id" }
    )
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}

export async function syncSubscriptionAndProfile(params: {
  userId: string;
  provider: "stripe" | "razorpay" | "system";
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerPriceId?: string | null;
  planTier: PlanTier;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  pausedAt?: string | null;
  gracePeriodEndsAt?: string | null;
  lastPaymentAt?: string | null;
  billingAddress?: Record<string, unknown>;
  taxId?: string | null;
}): Promise<{ subscriptionId: string | null; error?: string }> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    return { subscriptionId: null, error: "Service role client unavailable" };
  }

  const nowIso = new Date().toISOString();
  let subscriptionId: string | null = null;

  if (params.providerSubscriptionId) {
    const { data: subRow, error: subErr } = await adminDb
      .from("subscriptions")
      .upsert(
        {
          user_id: params.userId,
          provider: params.provider,
          provider_customer_id: params.providerCustomerId ?? null,
          provider_subscription_id: params.providerSubscriptionId,
          provider_price_id: params.providerPriceId ?? null,
          plan_tier: params.planTier,
          billing_cycle: params.billingCycle,
          status: params.status,
          current_period_start: params.currentPeriodStart,
          current_period_end: params.currentPeriodEnd,
          cancel_at_period_end: Boolean(params.cancelAtPeriodEnd),
          canceled_at: params.canceledAt ?? null,
          paused_at: params.pausedAt ?? null,
          grace_period_ends_at: params.gracePeriodEndsAt ?? null,
          last_payment_at: params.lastPaymentAt ?? null,
          billing_address: params.billingAddress ?? {},
          tax_id: params.taxId ?? null,
          updated_at: nowIso,
        },
        { onConflict: "provider_subscription_id" }
      )
      .select("id")
      .single();

    if (subErr) {
      return { subscriptionId: null, error: subErr.message };
    }
    subscriptionId = subRow?.id ?? null;
  }

  const isEntitled = params.status === "active" || params.status === "past_due";
  const effectivePlanTier: PlanTier = isEntitled ? params.planTier : "scheduler";

  const { error: profErr } = await adminDb
    .from("profiles")
    .update({
      plan_tier: effectivePlanTier,
      plan_status: params.status,
      plan_started_at: params.currentPeriodStart,
      plan_ends_at: params.currentPeriodEnd,
      ...(params.providerCustomerId
        ? { stripe_customer_id: params.providerCustomerId }
        : {}),
    })
    .eq("id", params.userId);

  if (profErr) {
    return { subscriptionId, error: profErr.message };
  }

  if (!isEntitled) {
    await pauseExcessWorkflowsForUser(params.userId, effectivePlanTier);
  }

  return { subscriptionId };
}

export async function enforceExpiredSubscriptions(): Promise<{
  checked: number;
  pausedOrExpired: number;
}> {
  const adminDb = createServiceRoleClient();
  if (!adminDb) return { checked: 0, pausedOrExpired: 0 };

  const nowIso = new Date().toISOString();
  const { data: dueSubs, error } = await adminDb
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due", "canceled"])
    .lt("current_period_end", nowIso)
    .limit(100);

  if (error || !dueSubs || dueSubs.length === 0) {
    return { checked: dueSubs?.length ?? 0, pausedOrExpired: 0 };
  }

  let pausedOrExpired = 0;

  for (const sub of dueSubs) {
    if (
      sub.status === "past_due" &&
      sub.grace_period_ends_at &&
      new Date(sub.grace_period_ends_at).getTime() > Date.now()
    ) {
      continue;
    }

    const nextStatus: SubscriptionStatus =
      sub.status === "canceled" || sub.cancel_at_period_end ? "expired" : "paused";
    const tier = (sub.plan_tier as PlanTier) in PLAN_CONFIGS
      ? (sub.plan_tier as PlanTier)
      : "scheduler";
    const cycle: BillingCycle = sub.billing_cycle === "yearly" ? "yearly" : "monthly";

    await syncSubscriptionAndProfile({
      userId: sub.user_id,
      provider: sub.provider,
      providerCustomerId: sub.provider_customer_id,
      providerSubscriptionId: sub.provider_subscription_id,
      providerPriceId: sub.provider_price_id,
      planTier: tier,
      billingCycle: cycle,
      status: nextStatus,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      canceledAt: sub.canceled_at,
      pausedAt: nowIso,
      billingAddress: (sub.billing_address as Record<string, unknown>) || {},
      taxId: sub.tax_id,
    });

    await recordBillingTransaction({
      userId: sub.user_id,
      subscriptionId: sub.id,
      provider: "system",
      providerEventId: `expiry_${sub.id}_${sub.current_period_end}`,
      providerSubscriptionId: sub.provider_subscription_id,
      eventKind: "paused_expired",
      planTier: tier,
      billingCycle: cycle,
      amountCents: 0,
      currency: "usd",
      status: "recorded",
      description: `Plan period ended (${sub.current_period_end}) without renewal; transitioned to ${nextStatus} and enforced plan limits.`,
      periodStart: sub.current_period_start,
      periodEnd: sub.current_period_end,
      occurredAt: nowIso,
    });

    pausedOrExpired += 1;
  }

  return { checked: dueSubs.length, pausedOrExpired };
}
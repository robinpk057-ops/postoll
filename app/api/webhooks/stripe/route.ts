import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/security/guards";
import { claimWebhookEvent } from "@/lib/security/payments";
import { PLAN_CONFIGS, getPlanConfig, type PlanTier } from "@/lib/plans";
import {
  grantPlanCreditsForBillingEvent,
  recordBillingTransaction,
  resolvePlanFromStripePriceId,
  sendBillingReceiptEmail,
  syncSubscriptionAndProfile,
  type BillingCycle,
  type SubscriptionStatus,
} from "@/lib/billing/ledger";

export const dynamic = "force-dynamic";

function isValidTier(val: unknown): val is PlanTier {
  return typeof val === "string" && val in PLAN_CONFIGS;
}

function getStripeSubPeriodIso(sub: Stripe.Subscription, fallbackIso: string): {
  periodStartIso: string;
  periodEndIso: string;
} {
  const item = sub.items.data[0];
  const rawStart =
    (sub as unknown as { current_period_start?: number }).current_period_start ??
    item?.current_period_start;
  const rawEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    item?.current_period_end;

  return {
    periodStartIso: rawStart ? new Date(rawStart * 1000).toISOString() : fallbackIso,
    periodEndIso: rawEnd ? new Date(rawEnd * 1000).toISOString() : fallbackIso,
  };
}

async function resolveUserIdFromStripe(params: {
  customerId?: string | null;
  metadataUserId?: string | null;
  clientReferenceId?: string | null;
  customerEmail?: string | null;
}): Promise<string | null> {
  if (params.metadataUserId) return params.metadataUserId;
  if (params.clientReferenceId) return params.clientReferenceId;

  const adminDb = createServiceRoleClient();
  const supaHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : "missing-url";

  if (!adminDb) {
    console.error("[resolveUserIdFromStripe] adminDb is null", { supaHost });
    return null;
  }

  if (params.customerId) {
    const { data: prof, error: profErr } = await adminDb
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", params.customerId)
      .maybeSingle();
    if (profErr) console.error("[resolveUserIdFromStripe] customer query error:", profErr);
    if (prof?.id) return prof.id;

    const { data: sub, error: subErr } = await adminDb
      .from("subscriptions")
      .select("user_id")
      .eq("provider_customer_id", params.customerId)
      .maybeSingle();
    if (subErr) console.error("[resolveUserIdFromStripe] sub query error:", subErr);
    if (sub?.user_id) return sub.user_id;
  }

  if (params.customerEmail) {
    const normalizedEmail = params.customerEmail.trim().toLowerCase();
    const { data: byEmail, error: emailErr } = await adminDb
      .from("profiles")
      .select("id, stripe_customer_id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (emailErr) console.error("[resolveUserIdFromStripe] email query error:", emailErr);

    if (byEmail?.id) {
      if (params.customerId && byEmail.stripe_customer_id !== params.customerId) {
        await adminDb
          .from("profiles")
          .update({ stripe_customer_id: params.customerId })
          .eq("id", byEmail.id);
      }
      return byEmail.id;
    }
  }

  console.error("[resolveUserIdFromStripe] No match found", {
    supaHost,
    customerId: params.customerId ?? null,
    customerEmail: params.customerEmail ?? null,
  });
  return null;
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secrets not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  const claimed = await claimWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    payloadSummary: { id: event.id, type: event.type, created: event.created },
  });

  if (claimed.alreadyProcessed) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  const adminDb = createServiceRoleClient();
  const occurredAtIso = new Date(event.created * 1000).toISOString();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const customerEmail = session.customer_details?.email || session.customer_email || null;

        const userId = await resolveUserIdFromStripe({
          customerId,
          metadataUserId: session.metadata?.user_id,
          clientReferenceId: session.client_reference_id,
          customerEmail,
        });

        if (!userId) {
          throw new Error(
            `Could not resolve userId for checkout.session.completed (customer=${customerId}, email=${customerEmail})`
          );
        }

        let planTier: PlanTier = isValidTier(session.metadata?.plan_tier)
          ? session.metadata.plan_tier
          : "scheduler";
        let billingCycle: BillingCycle =
          session.metadata?.billing_cycle === "yearly" ? "yearly" : "monthly";
        let priceId: string | null = null;
        let periodStartIso = occurredAtIso;
        let periodEndIso = new Date(
          event.created * 1000 +
            (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
        ).toISOString();

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const firstItem = sub.items.data[0];
          priceId = firstItem?.price?.id ?? null;
          const mapped = resolvePlanFromStripePriceId(priceId);
          if (mapped) {
            planTier = mapped.planTier;
            billingCycle = mapped.billingCycle;
          } else if (firstItem?.price?.recurring?.interval === "year") {
            billingCycle = "yearly";
          }
          const period = getStripeSubPeriodIso(sub, occurredAtIso);
          periodStartIso = period.periodStartIso;
          periodEndIso = period.periodEndIso;
        }

        const billingDetails = {
          address: session.customer_details?.address ?? null,
          tax_ids: session.customer_details?.tax_ids ?? [],
          payment_status: session.payment_status,
        };

        const synced = await syncSubscriptionAndProfile({
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: subscriptionId,
          providerPriceId: priceId,
          planTier,
          billingCycle,
          status: "active",
          currentPeriodStart: periodStartIso,
          currentPeriodEnd: periodEndIso,
          lastPaymentAt: session.payment_status === "paid" ? occurredAtIso : null,
          billingAddress: (session.customer_details?.address as unknown as Record<string, unknown>) || {},
          taxId: session.customer_details?.tax_ids?.[0]?.value ?? null,
        });

        if (synced.error) {
          throw new Error(`syncSubscriptionAndProfile failed: ${synced.error}`);
        }

        const amountCents = session.amount_total ?? 0;
        const taxCents = session.total_details?.amount_tax ?? 0;
        const currency = session.currency || "usd";
        const customerName = session.customer_details?.name || null;

        const txRes = await recordBillingTransaction({
          userId,
          subscriptionId: synced.subscriptionId,
          provider: "stripe",
          providerEventId: event.id,
          providerInvoiceId:
            typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null,
          providerPaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          providerSubscriptionId: subscriptionId,
          eventKind: "checkout_paid",
          planTier,
          billingCycle,
          amountCents,
          taxCents,
          currency,
          status: session.payment_status === "paid" ? "paid" : "pending",
          customerName,
          customerEmail,
          billingDetails,
          description: `Initial ${getPlanConfig(planTier).name} (${billingCycle}) checkout`,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          occurredAt: occurredAtIso,
        });

        if (!txRes.ok) {
          throw new Error(`recordBillingTransaction failed: ${txRes.error}`);
        }

        if (session.payment_status === "paid") {
          await grantPlanCreditsForBillingEvent({
            userId,
            planTier,
            eventKey: event.id,
          });
        }

        if (customerEmail) {
          await sendBillingReceiptEmail({
            toEmail: customerEmail,
            customerName,
            planName: getPlanConfig(planTier).name,
            billingCycle,
            eventKind: "checkout_paid",
            amountCents,
            currency,
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
        const rawSub = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
        const subscriptionId =
          typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;

        const userId = await resolveUserIdFromStripe({
          customerId,
          customerEmail: invoice.customer_email || null,
        });
        if (!userId) {
          throw new Error(
            `Could not resolve userId for invoice.paid (customer=${customerId}, email=${invoice.customer_email})`
          );
        }

        let planTier: PlanTier = "scheduler";
        let billingCycle: BillingCycle = "monthly";
        let priceId: string | null = null;
        let periodStartIso = invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString()
          : occurredAtIso;
        let periodEndIso = invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : new Date(event.created * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString();
        let cancelAtPeriodEnd = false;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const firstItem = sub.items.data[0];
          priceId = firstItem?.price?.id ?? null;
          const mapped = resolvePlanFromStripePriceId(priceId);
          if (mapped) {
            planTier = mapped.planTier;
            billingCycle = mapped.billingCycle;
          } else if (isValidTier(sub.metadata?.plan_tier)) {
            planTier = sub.metadata.plan_tier;
            if (sub.metadata?.billing_cycle === "yearly") billingCycle = "yearly";
          }
          const period = getStripeSubPeriodIso(sub, periodStartIso);
          periodStartIso = period.periodStartIso;
          periodEndIso = period.periodEndIso;
          cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
        }

        const eventKind =
          invoice.billing_reason === "subscription_create" ? "checkout_paid" : "renewal_paid";

        const synced = await syncSubscriptionAndProfile({
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: subscriptionId,
          providerPriceId: priceId,
          planTier,
          billingCycle,
          status: "active",
          currentPeriodStart: periodStartIso,
          currentPeriodEnd: periodEndIso,
          cancelAtPeriodEnd,
          canceledAt: null,
          pausedAt: null,
          gracePeriodEndsAt: null,
          lastPaymentAt: occurredAtIso,
          billingAddress: (invoice.customer_address as unknown as Record<string, unknown>) || {},
          taxId: invoice.customer_tax_ids?.[0]?.value ?? null,
        });

        if (synced.error) {
          throw new Error(`syncSubscriptionAndProfile failed on invoice.paid: ${synced.error}`);
        }

        const amountCents = invoice.amount_paid ?? invoice.total ?? 0;
        const taxCents = (invoice as unknown as { tax?: number }).tax ?? 0;
        const currency = invoice.currency || "usd";
        const customerEmail = invoice.customer_email || null;
        const customerName = invoice.customer_name || null;
        const rawPi = (invoice as unknown as { payment_intent?: string | { id?: string } | null }).payment_intent;

        const txRes = await recordBillingTransaction({
          userId,
          subscriptionId: synced.subscriptionId,
          provider: "stripe",
          providerEventId: event.id,
          providerInvoiceId: invoice.id,
          providerPaymentIntentId: typeof rawPi === "string" ? rawPi : rawPi?.id ?? null,
          providerSubscriptionId: subscriptionId,
          eventKind,
          planTier,
          billingCycle,
          amountCents,
          taxCents,
          currency,
          status: "paid",
          invoiceNumber: invoice.number ?? null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdfUrl: invoice.invoice_pdf ?? null,
          customerName,
          customerEmail,
          billingDetails: {
            address: invoice.customer_address ?? null,
            tax_ids: invoice.customer_tax_ids ?? [],
            billing_reason: invoice.billing_reason ?? null,
          },
          description:
            eventKind === "renewal_paid"
              ? `Subscription renewal payment (${getPlanConfig(planTier).name})`
              : `Invoice payment (${getPlanConfig(planTier).name})`,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          occurredAt: occurredAtIso,
        });

        if (!txRes.ok) {
          throw new Error(`recordBillingTransaction failed on invoice.paid: ${txRes.error}`);
        }

        await grantPlanCreditsForBillingEvent({
          userId,
          planTier,
          eventKey: event.id,
        });

        if (customerEmail) {
          await sendBillingReceiptEmail({
            toEmail: customerEmail,
            customerName,
            planName: getPlanConfig(planTier).name,
            billingCycle,
            eventKind,
            amountCents,
            currency,
            invoiceNumber: invoice.number ?? null,
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdfUrl: invoice.invoice_pdf ?? null,
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
        const rawSub = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
        const subscriptionId =
          typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;

        const userId = await resolveUserIdFromStripe({
          customerId,
          customerEmail: invoice.customer_email || null,
        });
        if (!userId) break;

        let planTier: PlanTier = "scheduler";
        let billingCycle: BillingCycle = "monthly";
        let priceId: string | null = null;
        let periodStartIso = occurredAtIso;
        let periodEndIso = occurredAtIso;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const firstItem = sub.items.data[0];
          priceId = firstItem?.price?.id ?? null;
          const mapped = resolvePlanFromStripePriceId(priceId);
          if (mapped) {
            planTier = mapped.planTier;
            billingCycle = mapped.billingCycle;
          }
          const period = getStripeSubPeriodIso(sub, occurredAtIso);
          periodStartIso = period.periodStartIso;
          periodEndIso = period.periodEndIso;
        }

        const graceUntilIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        const synced = await syncSubscriptionAndProfile({
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: subscriptionId,
          providerPriceId: priceId,
          planTier,
          billingCycle,
          status: "past_due",
          currentPeriodStart: periodStartIso,
          currentPeriodEnd: periodEndIso,
          gracePeriodEndsAt: graceUntilIso,
        });

        const amountCents = invoice.amount_due ?? invoice.total ?? 0;
        const currency = invoice.currency || "usd";
        const customerEmail = invoice.customer_email || null;

        await recordBillingTransaction({
          userId,
          subscriptionId: synced.subscriptionId,
          provider: "stripe",
          providerEventId: event.id,
          providerInvoiceId: invoice.id,
          providerSubscriptionId: subscriptionId,
          eventKind: "payment_failed",
          planTier,
          billingCycle,
          amountCents,
          currency,
          status: "failed",
          invoiceNumber: invoice.number ?? null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdfUrl: invoice.invoice_pdf ?? null,
          customerName: invoice.customer_name ?? null,
          customerEmail,
          description: `Payment failed for ${getPlanConfig(planTier).name}; grace window until ${graceUntilIso}`,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          occurredAt: occurredAtIso,
        });

        if (customerEmail) {
          await sendBillingReceiptEmail({
            toEmail: customerEmail,
            customerName: invoice.customer_name ?? null,
            planName: getPlanConfig(planTier).name,
            billingCycle,
            eventKind: "payment_failed",
            amountCents,
            currency,
            invoiceNumber: invoice.number ?? null,
            hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
        const userId = await resolveUserIdFromStripe({
          customerId,
          metadataUserId: sub.metadata?.user_id,
        });
        if (!userId) break;

        const firstItem = sub.items.data[0];
        const priceId = firstItem?.price?.id ?? null;
        const mapped = resolvePlanFromStripePriceId(priceId);

        let planTier: PlanTier = mapped?.planTier ?? "scheduler";
        let billingCycle: BillingCycle =
          mapped?.billingCycle ??
          (firstItem?.price?.recurring?.interval === "year" ? "yearly" : "monthly");

        if (!mapped && isValidTier(sub.metadata?.plan_tier)) {
          planTier = sub.metadata.plan_tier;
        }

        let prevTier: PlanTier | null = null;
        if (adminDb) {
          const { data: existingSub } = await adminDb
            .from("subscriptions")
            .select("plan_tier")
            .eq("provider_subscription_id", sub.id)
            .maybeSingle();
          if (existingSub && isValidTier(existingSub.plan_tier)) {
            prevTier = existingSub.plan_tier;
          }
        }

        let nextStatus: SubscriptionStatus = "active";
        if (sub.status === "past_due") nextStatus = "past_due";
        else if (sub.status === "canceled") nextStatus = "canceled";
        else if (sub.status === "paused") nextStatus = "paused";

        const { periodStartIso, periodEndIso } = getStripeSubPeriodIso(sub, occurredAtIso);

        const synced = await syncSubscriptionAndProfile({
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: sub.id,
          providerPriceId: priceId,
          planTier,
          billingCycle,
          status: nextStatus,
          currentPeriodStart: periodStartIso,
          currentPeriodEnd: periodEndIso,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          canceledAt: sub.canceled_at
            ? new Date(sub.canceled_at * 1000).toISOString()
            : sub.cancel_at_period_end
              ? occurredAtIso
              : null,
          pausedAt: nextStatus === "paused" ? occurredAtIso : null,
        });

        const previousTier = prevTier;
        const isPlanChange = previousTier !== null && previousTier !== planTier;
        const eventKind = isPlanChange
          ? PLAN_CONFIGS[planTier].monthlyPriceUsd >= PLAN_CONFIGS[previousTier].monthlyPriceUsd
            ? "upgraded"
            : "downgraded"
          : sub.cancel_at_period_end
            ? "canceled"
            : null;

        if (eventKind) {
          await recordBillingTransaction({
            userId,
            subscriptionId: synced.subscriptionId,
            provider: "stripe",
            providerEventId: event.id,
            providerSubscriptionId: sub.id,
            eventKind,
            planTier,
            billingCycle,
            amountCents: 0,
            currency: firstItem?.price?.currency || "usd",
            status: "recorded",
            description:
              eventKind === "upgraded"
                ? `Upgraded plan from ${prevTier} to ${planTier}`
                : eventKind === "downgraded"
                  ? `Changed plan from ${prevTier} to ${planTier}`
                  : `Subscription scheduled to cancel at period end (${periodEndIso})`,
            periodStart: periodStartIso,
            periodEnd: periodEndIso,
            occurredAt: occurredAtIso,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
        const userId = await resolveUserIdFromStripe({
          customerId,
          metadataUserId: sub.metadata?.user_id,
        });
        if (!userId) break;

        const firstItem = sub.items.data[0];
        const priceId = firstItem?.price?.id ?? null;
        const mapped = resolvePlanFromStripePriceId(priceId);
        const planTier: PlanTier = mapped?.planTier ?? "scheduler";
        const billingCycle: BillingCycle = mapped?.billingCycle ?? "monthly";
        const { periodStartIso, periodEndIso } = getStripeSubPeriodIso(sub, occurredAtIso);

        const synced = await syncSubscriptionAndProfile({
          userId,
          provider: "stripe",
          providerCustomerId: customerId,
          providerSubscriptionId: sub.id,
          providerPriceId: priceId,
          planTier,
          billingCycle,
          status: "canceled",
          currentPeriodStart: periodStartIso,
          currentPeriodEnd: periodEndIso,
          cancelAtPeriodEnd: false,
          canceledAt: occurredAtIso,
          pausedAt: occurredAtIso,
        });

        await recordBillingTransaction({
          userId,
          subscriptionId: synced.subscriptionId,
          provider: "stripe",
          providerEventId: event.id,
          providerSubscriptionId: sub.id,
          eventKind: "canceled",
          planTier,
          billingCycle,
          amountCents: 0,
          currency: firstItem?.price?.currency || "usd",
          status: "recorded",
          description: `Subscription ended/canceled (${sub.id}); plan paused/reverted to base tier.`,
          periodStart: periodStartIso,
          periodEnd: periodEndIso,
          occurredAt: occurredAtIso,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const customerId =
          typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;
        const userId = await resolveUserIdFromStripe({
          customerId,
          customerEmail: charge.billing_details?.email || charge.receipt_email || null,
        });
        if (!userId) break;

        await recordBillingTransaction({
          userId,
          provider: "stripe",
          providerEventId: event.id,
          providerPaymentIntentId:
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id ?? null,
          eventKind: "refunded",
          planTier: "scheduler",
          billingCycle: "monthly",
          amountCents: -(charge.amount_refunded ?? charge.amount ?? 0),
          currency: charge.currency || "usd",
          status: "refunded",
          customerName: charge.billing_details?.name ?? null,
          customerEmail: charge.billing_details?.email ?? null,
          billingDetails: {
            address: charge.billing_details?.address ?? null,
          },
          description: `Charge refunded (${charge.id})`,
          occurredAt: occurredAtIso,
        });
        break;
      }

      default:
        break;
    }

    if (adminDb) {
      await adminDb
        .from("payment_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("provider", "stripe")
        .eq("event_id", event.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing error";
    console.error("[stripe-webhook] Error:", message);
    if (adminDb) {
      await adminDb
        .from("payment_webhook_events")
        .update({ status: "error", processed_at: new Date().toISOString() })
        .eq("provider", "stripe")
        .eq("event_id", event.id);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
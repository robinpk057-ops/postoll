import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuthenticatedUser } from "@/lib/api-guard";
import { isSameOrigin, createServiceRoleClient } from "@/lib/security/guards";
import { PLAN_CONFIGS, type PlanTier } from "@/lib/plans";
import { getStripePriceId, type BillingCycle } from "@/lib/billing/ledger";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireAuthenticatedUser(req, {
    routeName: "billing-checkout",
    maxRequests: 15,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe billing is not configured yet (missing STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const planTier = String(body?.planTier || "").trim() as PlanTier;
  const billingCycle: BillingCycle =
    body?.billingCycle === "yearly" ? "yearly" : "monthly";

  if (!(planTier in PLAN_CONFIGS)) {
    return NextResponse.json({ error: "Invalid plan tier." }, { status: 400 });
  }

  const priceId = getStripePriceId(planTier, billingCycle);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Stripe price ID not configured for ${planTier} (${billingCycle}).`,
      },
      { status: 503 }
    );
  }

  const { user } = auth;
  const adminDb = createServiceRoleClient();

  let customerId: string | undefined;
  if (adminDb) {
    const { data: prof } = await adminDb
      .from("profiles")
      .select("stripe_customer_id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (prof?.stripe_customer_id) {
      customerId = prof.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email || prof?.email || undefined,
        name: prof?.full_name || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await adminDb
        .from("profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("id", user.id);
    }
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: {
      address: "auto",
      name: "auto",
    },
    allow_promotion_codes: true,
    metadata: {
      user_id: user.id,
      plan_tier: planTier,
      billing_cycle: billingCycle,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan_tier: planTier,
        billing_cycle: billingCycle,
      },
    },
    success_url: `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/upgrade?billing=canceled`,
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    url: session.url,
  });
}
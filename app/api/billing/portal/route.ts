import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuthenticatedUser } from "@/lib/api-guard";
import { isSameOrigin, createServiceRoleClient } from "@/lib/security/guards";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireAuthenticatedUser(req, {
    routeName: "billing-portal",
    maxRequests: 15,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe billing is not configured yet." },
      { status: 503 }
    );
  }

  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    return NextResponse.json(
      { error: "Database service unavailable." },
      { status: 500 }
    );
  }

  const { data: prof } = await adminDb
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!prof?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active Stripe customer profile found for your account yet." },
      { status: 404 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: prof.stripe_customer_id,
    return_url: `${appUrl}/settings`,
  });

  return NextResponse.json({ ok: true, url: portalSession.url });
}
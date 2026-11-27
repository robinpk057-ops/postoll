import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-guard";
import { PLAN_CONFIGS, type PlanTier } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, {
    routeName: "billing-plan-post",
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { user, supabase } = auth;
  const body = await req.json().catch(() => ({}));
  const tier = String(body?.planTier || "").trim() as PlanTier;
  const billingCycle =
    body?.billingCycle === "yearly" ? "yearly" : "monthly";

  if (!(tier in PLAN_CONFIGS)) {
    return NextResponse.json(
      { error: "Invalid plan tier selected." },
      { status: 400 }
    );
  }

  const config = PLAN_CONFIGS[tier];

  // Update plan_tier on profiles (gracefully handles deployments that only have credits/email/full_name)
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ plan_tier: config.id })
    .eq("id", user.id);

  if (profErr) {
    return NextResponse.json(
      { error: profErr.message || "Unable to update plan tier." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    planTier: config.id,
    billingCycle,
    plan: config,
  });
}

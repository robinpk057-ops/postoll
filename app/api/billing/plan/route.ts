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

  const body = await req.json().catch(() => ({}));
  const tier = String(body?.planTier || "").trim() as PlanTier;

  if (!(tier in PLAN_CONFIGS)) {
    return NextResponse.json(
      { error: "Invalid plan tier selected." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Direct plan activation requires verified checkout payment. Use /api/billing/checkout to subscribe or /api/billing/portal to manage your existing plan.",
    },
    { status: 403 }
  );
}
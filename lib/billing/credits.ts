import "server-only";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/security/guards";

export async function checkAndDeductCredits(params: {
  userId: string;
  cost: number;
  endpoint: string;
  provider?: string;
  estimatedCostUsd?: number;
}): Promise<
  | { ok: true; remainingCredits: number }
  | { ok: false; response: NextResponse }
> {
  const cost = Math.max(1, Math.round(params.cost));
  const adminDb = createServiceRoleClient();
  if (!adminDb) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Database service unavailable for credit verification." },
        { status: 500 }
      ),
    };
  }

  const { data: prof, error: profErr } = await adminDb
    .from("profiles")
    .select("credits")
    .eq("id", params.userId)
    .single();

  if (profErr || !prof) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unable to verify user credit balance." },
        { status: 500 }
      ),
    };
  }

  const currentCredits = Number(prof.credits ?? 0);
  if (!Number.isFinite(currentCredits) || currentCredits < cost) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Insufficient AI credits (${currentCredits} available, ${cost} required). Please upgrade your plan or add credits.`,
          creditsAvailable: Number.isFinite(currentCredits) ? currentCredits : 0,
          creditsRequired: cost,
        },
        { status: 402 }
      ),
    };
  }

  const nextCredits = Math.max(0, currentCredits - cost);
  const { data: updated, error: updErr } = await adminDb
    .from("profiles")
    .update({ credits: nextCredits })
    .eq("id", params.userId)
    .gte("credits", cost)
    .select("credits")
    .single();

  if (updErr || !updated) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Insufficient AI credits or concurrent balance update conflict." },
        { status: 402 }
      ),
    };
  }

  try {
    await adminDb.from("api_usage_logs").insert({
      user_id: params.userId,
      provider: params.provider || "ai_studio",
      endpoint: params.endpoint,
      status: "success",
      credits_charged: cost,
      estimated_cost_usd: params.estimatedCostUsd ?? 0,
    });
  } catch {
    // Non-blocking audit log insert
  }

  return { ok: true, remainingCredits: Number(updated.credits ?? nextCredits) };
}
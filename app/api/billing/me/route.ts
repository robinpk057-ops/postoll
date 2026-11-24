import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, {
    routeName: "billing-me-get",
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { user, supabase } = auth;

  let { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, username, credits")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  if (!profile) {
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ? user.email.toLowerCase() : null,
        full_name:
          user.user_metadata?.full_name ||
          (user.email ? user.email.split("@")[0] : "User"),
        credits: 25,
      })
      .select("id, email, full_name, username, credits")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    profile = created;
  }

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, reason, delta, balance_after, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    ok: true,
    userId: user.id,
    credits: typeof profile?.credits === "number" ? profile.credits : 0,
    profile,
    transactions: transactions || [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, {
    routeName: "billing-me-post",
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { user, supabase } = auth;
  const body = await req.json().catch(() => ({}));
  const creditsToAdd = Number(body?.credits ?? 0);
  const note = String(body?.note || "Credit bundle purchase").slice(0, 200);

  if (!Number.isInteger(creditsToAdd) || creditsToAdd < 1 || creditsToAdd > 10000) {
    return NextResponse.json(
      { error: "Enter a valid whole number of credits between 1 and 10,000." },
      { status: 400 }
    );
  }

  const { data: rows, error: rpcErr } = await supabase.rpc("add_credits", {
    p_user_id: user.id,
    p_amount: creditsToAdd,
    p_reason: "purchase",
    p_note: note,
  });

  const result = Array.isArray(rows) ? rows[0] : rows;
  if (rpcErr || !result?.ok) {
    return NextResponse.json(
      { error: result?.message || rpcErr?.message || "Failed to add credits." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    credits: result.balance_after,
    added: creditsToAdd,
  });
}

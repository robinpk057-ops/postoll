import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  verifyAdminRequest,
} from "@/lib/security/guards";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = createServiceRoleClient() ?? (await createClient());
  const statusFilter = req.nextUrl.searchParams.get("status");

  let query = db
    .from("watchdog_incidents")
    .select(
      "id, fingerprint, source, severity, category, title, summary, recommended_action, affected_route_or_feature, affected_user_id, occurrence_count, status, email_sent_at, created_at, last_seen_at"
    )
    .order("last_seen_at", { ascending: false })
    .limit(100);

  if (
    statusFilter === "open" ||
    statusFilter === "acknowledged" ||
    statusFilter === "resolved"
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      incidents: [],
      summary: { open: 0, acknowledged: 0, resolved: 0, criticalOpen: 0 },
      tableReady: false,
      warning: error.message,
    });
  }

  const incidents = data ?? [];
  const summary = {
    open: incidents.filter((i) => i.status === "open").length,
    acknowledged: incidents.filter((i) => i.status === "acknowledged").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    criticalOpen: incidents.filter(
      (i) => i.status === "open" && i.severity === "critical"
    ).length,
  };

  return NextResponse.json({
    incidents,
    summary,
    tableReady: true,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";

  if (
    !id ||
    (status !== "open" && status !== "acknowledged" && status !== "resolved")
  ) {
    return NextResponse.json(
      { error: "Valid incident id and status are required" },
      { status: 400 }
    );
  }

  const db = createServiceRoleClient() ?? (await createClient());
  const { error } = await db
    .from("watchdog_incidents")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status });
}

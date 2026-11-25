import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type AdminActor = {
  userId: string;
  email: string | null;
};

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function verifyAdminRequest(): Promise<
  { ok: true; actor: AdminActor } | { ok: false; status: number; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return { ok: false, status: 403, error: "Forbidden: admin access required" };
    }

    return {
      ok: true,
      actor: {
        userId: user.id,
        email: user.email ?? null,
      },
    };
  } catch {
    return { ok: false, status: 500, error: "Failed to verify admin session" };
  }
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Allow non-browser / server-to-server requests without Origin header
  if (!origin) return true;
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export async function recordAdminAudit(params: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const adminDb = createServiceRoleClient();
    const client = adminDb ?? (await createClient());

    await client.from("admin_audit_logs").insert({
      actor_user_id: params.actorUserId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      details: params.details ?? {},
    });
  } catch {
    // Non-blocking audit write
  }
}

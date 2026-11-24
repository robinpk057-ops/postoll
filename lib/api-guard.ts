import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function requireAuthenticatedUser(
  req: NextRequest,
  options?: { routeName?: string; maxRequests?: number; windowMs?: number }
) {
  const ip = getClientIp(req.headers);
  const routeKey = `${options?.routeName || req.nextUrl.pathname}:${ip}`;
  const maxReq = options?.maxRequests ?? 30;
  const winMs = options?.windowMs ?? 60_000;

  const rl = checkRateLimit(routeKey, maxReq, winMs);
  if (!rl.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return { ok: true as const, user, supabase };
}

export async function verifyRecordOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  recordId: string,
  userId: string
): Promise<{ owned: boolean; errorMessage?: string }> {
  if (!recordId || !/^[0-9a-fA-F-]{8,36}$/.test(recordId)) {
    return { owned: false, errorMessage: "Invalid resource identifier." };
  }

  const { data, error } = await supabase
    .from(table)
    .select("id, user_id")
    .eq("id", recordId)
    .maybeSingle();

  if (error || !data) {
    return { owned: false, errorMessage: "Resource not found." };
  }

  if (data.user_id !== userId) {
    return { owned: false, errorMessage: "Forbidden: you do not own this resource." };
  }

  return { owned: true };
}

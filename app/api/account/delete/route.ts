import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/api-guard";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin environment configuration.");
  }
  return createAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, {
    routeName: "account-delete-post",
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!auth.ok) return auth.response;

  const { user, supabase } = auth;
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json(
      { error: "Current password is required to delete your account." },
      { status: 400 }
    );
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "Account email is missing; cannot verify password." },
      { status: 400 }
    );
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "Incorrect password. Account was not deleted." },
      { status: 401 }
    );
  }

  const admin = getAdmin();

  await Promise.allSettled([
    admin.from("api_keys").delete().eq("user_id", user.id),
    admin.from("credit_transactions").delete().eq("user_id", user.id),
    admin.from("schedule_slots").delete().eq("user_id", user.id),
    admin.from("schedule_settings").delete().eq("user_id", user.id),
    admin.from("profiles").delete().eq("id", user.id),
  ]);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(
    user.id
  );

  if (deleteUserError) {
    return NextResponse.json(
      { error: deleteUserError.message || "Failed to delete account." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

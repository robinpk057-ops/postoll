"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import { getPasswordChecklist, validateStrongPassword } from "@/lib/security";
import { PLAN_CONFIGS, getPlanConfig, type PlanTier } from "@/lib/plans";

type BillingSummary = {
  planTier: PlanTier;
  planStatus: string;
  purchasedAt: string | null;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
};

type UserBillingTx = {
  id: string;
  event_kind: string;
  plan_tier: string;
  billing_cycle: string;
  amount_cents: number;
  currency: string;
  status: string;
  invoice_number: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  period_start: string | null;
  period_end: string | null;
  occurred_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleString();
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [billing, setBilling] = useState<BillingSummary>({
    planTier: "scheduler",
    planStatus: "active",
    purchasedAt: null,
    expiresAt: null,
    cancelAtPeriodEnd: false,
  });
  const [billingHistory, setBillingHistory] = useState<UserBillingTx[]>([]);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmedPermission, setDeleteConfirmedPermission] =
    useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const pwChecks = getPasswordChecklist(newPassword);

  const loadAccountData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please log in to view your account settings.");
      }

      setUserId(user.id);
      setUserEmail(user.email || "");
      setFullName(
        user.user_metadata?.full_name ||
          (user.email ? user.email.split("@")[0] : "User")
      );

      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profError) {
        throw profError;
      }

      const row = (prof || {}) as Record<string, unknown>;
      if (typeof row.full_name === "string" && row.full_name.trim()) {
        setFullName(row.full_name.trim());
      }
      if (typeof row.username === "string") {
        setUsername(row.username);
      }

      const { data: subRow } = await supabase
        .from("subscriptions")
        .select(
          "plan_tier, status, current_period_start, current_period_end, cancel_at_period_end"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: txRows } = await supabase
        .from("billing_transactions")
        .select(
          "id, event_kind, plan_tier, billing_cycle, amount_cents, currency, status, invoice_number, hosted_invoice_url, invoice_pdf_url, period_start, period_end, occurred_at"
        )
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(25);

      if (Array.isArray(txRows)) {
        setBillingHistory(txRows as UserBillingTx[]);
      }

      const resolvedTier = getPlanConfig(
        typeof subRow?.plan_tier === "string" &&
          (subRow.status === "active" || subRow.status === "past_due")
          ? subRow.plan_tier
          : typeof row.plan_tier === "string"
          ? row.plan_tier
          : "scheduler"
      ).id;

      const purchasedRaw =
        typeof subRow?.current_period_start === "string" && subRow.current_period_start
          ? subRow.current_period_start
          : typeof row.plan_started_at === "string" && row.plan_started_at
          ? row.plan_started_at
          : typeof row.updated_at === "string" && row.updated_at
          ? row.updated_at
          : typeof row.created_at === "string" && row.created_at
          ? row.created_at
          : null;

      const expiresRaw =
        typeof subRow?.current_period_end === "string" && subRow.current_period_end
          ? subRow.current_period_end
          : typeof row.plan_ends_at === "string" && row.plan_ends_at
          ? row.plan_ends_at
          : typeof row.plan_expires_at === "string" && row.plan_expires_at
          ? row.plan_expires_at
          : null;

      setBilling({
        planTier: resolvedTier,
        planStatus:
          typeof subRow?.status === "string"
            ? subRow.status
            : typeof row.plan_status === "string"
            ? row.plan_status
            : "active",
        purchasedAt: purchasedRaw,
        expiresAt: expiresRaw,
        cancelAtPeriodEnd: Boolean(subRow?.cancel_at_period_end),
      });
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Unable to load account settings."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  async function handleSaveUsername(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileMessage(null);

    if (!userId) {
      setProfileError("Please log in first.");
      return;
    }

    const cleaned = username.trim();
    if (cleaned.length < 2 || cleaned.length > 40) {
      setProfileError("Username must be between 2 and 40 characters.");
      return;
    }

    try {
      setSavingUsername(true);
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: userEmail ? userEmail.toLowerCase() : null,
            full_name: fullName || null,
            username: cleaned,
          },
          { onConflict: "id" }
        );

      if (upsertErr) {
        throw new Error(upsertErr.message);
      }

      setUsername(cleaned);
      setProfileMessage("Username updated.");
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Unable to update username."
      );
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!userId) {
      setPasswordError("Please log in to update your password.");
      return;
    }

    const check = validateStrongPassword(newPassword);
    if (!check.valid) {
      setPasswordError(
        check.error || "New password does not meet security requirements."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    try {
      setUpdatingPassword(true);
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to update password."
      );
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    if (!deleteConfirmedPermission) {
      setDeleteError("Please confirm permission to permanently delete your account.");
      return;
    }

    if (!deletePassword) {
      setDeleteError("Enter your current password to confirm deletion.");
      return;
    }

    try {
      setDeletingAccount(true);
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to delete account.");
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete account."
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  const activePlan = PLAN_CONFIGS[billing.planTier];

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen">
          <div className="mx-auto w-full px-4 py-10 sm:px-6 lg:px-8">
            <div className="h-9 w-48 animate-pulse rounded-xl bg-white/10" />
            <div className="mt-6 space-y-6">
              <div className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-44 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-60 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen">
        <div className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div
            className="mb-8 flex flex-col gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,92,255,0.16) 0%, var(--card) 55%, rgba(56,189,248,0.12) 100%)",
              borderColor: "var(--border)",
            }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#C4B5FD]">
                Account &amp; Billing
              </p>
              <h1 className="mt-1.5 text-3xl font-black tracking-tight sm:text-4xl">
                Settings
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Manage your account profile, username, password, plan details,
                and session.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="self-start rounded-xl border px-4 py-2.5 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.06] sm:self-auto"
              style={{ borderColor: "var(--border)" }}
            >
              Log out
            </button>
          </div>

          {loadError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {loadError}
            </div>
          )}

          <section
            className="mb-6 rounded-2xl border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-lg font-bold">Profile details</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Your logged-in account details and username.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Name
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {fullName || "Not set"}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Email
                </p>
                <p className="mt-1 break-all text-sm font-bold text-white">
                  {userEmail || "Not available"}
                </p>
              </div>
            </div>

            {profileError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {profileError}
              </div>
            )}

            {profileMessage && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {profileMessage}
              </div>
            )}

            <form onSubmit={handleSaveUsername} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label className="block text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={savingUsername}
                className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
              >
                {savingUsername ? "Saving..." : "Save username"}
              </button>
            </form>
          </section>

          <section
            className="mb-6 rounded-2xl border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Billing &amp; subscription</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Your active plan and recorded subscription timestamps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={openingPortal}
                  onClick={async () => {
                    try {
                      setOpeningPortal(true);
                      setPortalError(null);
                      const res = await fetch("/api/billing/portal", { method: "POST" });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok || !data.url) {
                        throw new Error(data.error || "Unable to open billing portal.");
                      }
                      window.location.href = data.url;
                    } catch (err) {
                      setPortalError(
                        err instanceof Error ? err.message : "Unable to open billing portal."
                      );
                      setOpeningPortal(false);
                    }
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {openingPortal ? "Opening Portal..." : "Manage Billing / Cancel"}
                </button>
                <Link
                  href="/upgrade"
                  className="rounded-xl border border-[#7C5CFF]/50 bg-[#7C5CFF]/15 px-4 py-2 text-xs font-bold text-[#C4B5FD] transition hover:bg-[#7C5CFF]/25"
                >
                  Manage / Upgrade Plan
                </Link>
              </div>
            </div>

            {portalError && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                {portalError}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Current plan
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {activePlan.name} (${activePlan.monthlyPriceUsd.toFixed(2)}/mo)
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Billing status
                </p>
                <p className="mt-1 text-sm font-bold uppercase text-white">
                  {billing.planStatus}
                  {billing.cancelAtPeriodEnd ? " (Cancels at end)" : ""}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Plan purchased / started
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {formatDateTime(billing.purchasedAt)}
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Plan ending / renewal time
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {formatDateTime(billing.expiresAt)}
                </p>
              </div>
            </div>

            {billingHistory.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-white">Billing history &amp; invoices</h3>
                <div className="mt-3 space-y-2">
                  {billingHistory.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col gap-2 rounded-xl border p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--background)",
                      }}
                    >
                      <div>
                        <span className="font-bold uppercase text-white">
                          {tx.event_kind.replace("_", " ")}
                        </span>
                        <span className="mx-2 text-neutral-500">&bull;</span>
                        <span className="text-neutral-300">
                          {getPlanConfig(tx.plan_tier).name} ({tx.billing_cycle})
                        </span>
                        <span className="mx-2 text-neutral-500">&bull;</span>
                        <span className="text-neutral-400">
                          {formatDateTime(tx.occurred_at)}
                        </span>
                        {tx.invoice_number && (
                          <span className="ml-2 text-neutral-400">
                            Invoice #{tx.invoice_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">
                          {(tx.amount_cents / 100).toFixed(2)} {tx.currency.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] uppercase text-neutral-300">
                          {tx.status}
                        </span>
                        {tx.hosted_invoice_url && (
                          <a
                            href={tx.hosted_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#C4B5FD] underline"
                          >
                            Invoice
                          </a>
                        )}
                        {tx.invoice_pdf_url && (
                          <a
                            href={tx.invoice_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-emerald-300 underline"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section
            className="mb-6 rounded-2xl border p-6"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-lg font-bold">Update password</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Set a new password for {userEmail || "your account"}.
            </p>

            {passwordError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full rounded-xl border px-3.5 py-2.5 pr-16 text-sm outline-none"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        borderColor: "var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium opacity-80 hover:opacity-100"
                    >
                      {showNewPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-xl border px-3.5 py-2.5 pr-16 text-sm outline-none"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                        borderColor: "var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium opacity-80 hover:opacity-100"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                <li
                  className={
                    pwChecks.minLength ? "text-emerald-400" : "text-neutral-400"
                  }
                >
                  {pwChecks.minLength ? "\u2713" : "\u25CB"} At least 8
                  characters
                </li>
                <li
                  className={
                    pwChecks.hasAlphabet
                      ? "text-emerald-400"
                      : "text-neutral-400"
                  }
                >
                  {pwChecks.hasAlphabet ? "\u2713" : "\u25CB"} Contains an
                  alphabet letter (A-Z)
                </li>
                <li
                  className={
                    pwChecks.hasNumber ? "text-emerald-400" : "text-neutral-400"
                  }
                >
                  {pwChecks.hasNumber ? "\u2713" : "\u25CB"} Contains 1 or more
                  numbers (0-9)
                </li>
                <li
                  className={
                    pwChecks.hasSpecial
                      ? "text-emerald-400"
                      : "text-neutral-400"
                  }
                >
                  {pwChecks.hasSpecial ? "\u2713" : "\u25CB"} Contains 1 or more
                  special characters (!@#$%^&amp;*)
                </li>
              </ul>

              <button
                type="submit"
                disabled={updatingPassword}
                className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
              >
                {updatingPassword ? "Updating password..." : "Update password"}
              </button>
            </form>
          </section>

          <section
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "rgba(239, 68, 68, 0.35)",
            }}
          >
            <h2 className="text-lg font-bold text-rose-300">Delete account</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Permanently remove your account and profile data. This action requires
              your permission and password verification.
            </p>

            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(true);
                  setDeleteError(null);
                  setDeleteConfirmedPermission(false);
                  setDeletePassword("");
                }}
                className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-500/25"
              >
                Delete account
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="mt-4 space-y-4">
                {deleteError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {deleteError}
                  </div>
                )}

                <label className="flex items-start gap-2.5 text-sm text-neutral-200">
                  <input
                    type="checkbox"
                    checked={deleteConfirmedPermission}
                    onChange={(e) =>
                      setDeleteConfirmedPermission(e.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    I give permission to permanently delete my Postoll account.
                  </span>
                </label>

                <div className="max-w-md space-y-1.5">
                  <label className="block text-sm font-medium">
                    Current password
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password to confirm"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      background: "var(--background)",
                      color: "var(--foreground)",
                      borderColor: "var(--border)",
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={deletingAccount}
                    className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deletingAccount
                      ? "Deleting account..."
                      : "Confirm permanent deletion"}
                  </button>
                  <button
                    type="button"
                    disabled={deletingAccount}
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteError(null);
                      setDeletePassword("");
                      setDeleteConfirmedPermission(false);
                    }}
                    className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.05]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

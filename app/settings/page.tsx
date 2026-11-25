"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import {
  getPasswordChecklist,
  validateStrongPassword,
} from "@/lib/security";

type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

type Day = {
  key: DayKey;
  label: string;
  short: string;
  value: number;
};

type ScheduleSlot = {
  id: string;
  user_id: string;
  day_of_week: number;
  time: string;
  content_type: "all" | "post" | "reel";
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

const DAYS: Day[] = [
  { key: "monday", label: "Monday", short: "Mon", value: 1 },
  { key: "tuesday", label: "Tuesday", short: "Tue", value: 2 },
  { key: "wednesday", label: "Wednesday", short: "Wed", value: 3 },
  { key: "thursday", label: "Thursday", short: "Thu", value: 4 },
  { key: "friday", label: "Friday", short: "Fri", value: 5 },
  { key: "saturday", label: "Saturday", short: "Sat", value: 6 },
  { key: "sunday", label: "Sunday", short: "Sun", value: 0 },
];

const TIMEZONES = [
  "Asia/Kolkata",
  "Europe/Bucharest",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

function formatTime(time: string) {
  if (!time) {
    return "";
  }

  const [hourString, minuteString] = time.split(":");

  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return time;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export default function SettingsPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [automaticScheduling, setAutomaticScheduling] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const pwChecks = getPasswordChecklist(newPassword);

  type ApiKeyRow = {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
  };

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeyCreating, setApiKeyCreating] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("n8n");
  const [apiKeySecretOnce, setApiKeySecretOnce] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  async function handleUpdateAccountPassword(e: FormEvent) {
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
      setPasswordSuccess("Your account password has been updated.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to update password."
      );
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function loadApiKeys() {
    try {
      setApiKeysLoading(true);
      setApiKeyError(null);
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load API keys");
      setApiKeys(data.keys || []);
    } catch (e) {
      setApiKeyError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setApiKeysLoading(false);
    }
  }

  async function createApiKey() {
    try {
      setApiKeyCreating(true);
      setApiKeyError(null);
      setApiKeySecretOnce(null);
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: apiKeyName.trim() || "n8n" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setApiKeySecretOnce(data.secret);
      await loadApiKeys();
    } catch (e) {
      setApiKeyError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setApiKeyCreating(false);
    }
  }

  async function revokeApiKey(id: string) {
    if (!confirm("Revoke this API key? Tools using it will stop working.")) {
      return;
    }
    try {
      setApiKeyError(null);
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to revoke key");
      setApiKeySecretOnce(null);
      await loadApiKeys();
    } catch (e) {
      setApiKeyError(e instanceof Error ? e.message : "Failed to revoke key");
    }
  }

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please log in to manage scheduling settings.");
      }

      setUserId(user.id);
      setUserEmail(user.email || null);

      const { data: settings, error: settingsError } = await supabase
        .from("schedule_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      if (settings) {
        if (typeof settings.automatic_scheduling === "boolean") {
          setAutomaticScheduling(settings.automatic_scheduling);
        }

        if (typeof settings.timezone === "string" && settings.timezone) {
          setTimezone(settings.timezone);
        }

        if (Array.isArray(settings.posting_days)) {
          setSelectedDays(
            settings.posting_days
              .map((day: unknown) => Number(day))
              .filter((day: number) => day >= 0 && day <= 6)
          );
        }
      }

      const { data: slotData, error: slotsError } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week", { ascending: true })
        .order("time", { ascending: true });

      if (slotsError) {
        throw slotsError;
      }

      setSlots((slotData as ScheduleSlot[]) || []);
    } catch (err) {
      console.error("Load schedule settings error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load scheduling settings."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function saveMainSettings(updates: Record<string, unknown>) {
    if (!userId) {
      throw new Error("You must be logged in.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("schedule_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("schedule_settings")
        .update(updates)
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase
      .from("schedule_settings")
      .insert({
        user_id: userId,
        ...updates,
      });

    if (insertError) {
      throw insertError;
    }
  }

  async function toggleAutomaticScheduling() {
    const nextValue = !automaticScheduling;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveMainSettings({
        automatic_scheduling: nextValue,
      });

      setAutomaticScheduling(nextValue);

      setSuccess(
        nextValue
          ? "Automatic scheduling is now enabled."
          : "Automatic scheduling is now disabled."
      );
    } catch (err) {
      console.error("Automatic scheduling update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update automatic scheduling."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleDay(day: number) {
    const isSelected = selectedDays.includes(day);

    const nextDays = isSelected
      ? selectedDays.filter((value) => value !== day)
      : [...selectedDays, day].sort((a, b) => a - b);

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveMainSettings({
        posting_days: nextDays,
      });

      setSelectedDays(nextDays);

      setSuccess("Posting days updated.");
    } catch (err) {
      console.error("Posting days update error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to update posting days."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeTimezone(nextTimezone: string) {
    try {
      setTimezone(nextTimezone);
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveMainSettings({
        timezone: nextTimezone,
      });

      setSuccess("Timezone updated.");
    } catch (err) {
      console.error("Timezone update error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to update timezone."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addSlot(dayOfWeek: number) {
    if (!userId) {
      return;
    }

    try {
      setAddingDay(dayOfWeek);
      setError(null);
      setSuccess(null);

      const existingForDay = slots.filter(
        (slot) => slot.day_of_week === dayOfWeek
      );

      let defaultTime = "09:00";

      if (existingForDay.length > 0) {
        const last = existingForDay[existingForDay.length - 1];
        const [hour, minute] = last.time.split(":");

        let nextHour = Number(hour) + 2;
        if (nextHour > 23) {
          nextHour = 23;
        }

        defaultTime = `${String(nextHour).padStart(2, "0")}:${minute}`;
      }

      const { data, error: insertError } = await supabase
        .from("schedule_slots")
        .insert({
          user_id: userId,
          day_of_week: dayOfWeek,
          time: defaultTime,
          content_type: "all",
          enabled: true,
        })
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        setSlots((current) =>
          [...current, data as ScheduleSlot].sort((a, b) => {
            if (a.day_of_week !== b.day_of_week) {
              return a.day_of_week - b.day_of_week;
            }
            return a.time.localeCompare(b.time);
          })
        );
      }

      setSuccess("Posting time added.");
    } catch (err) {
      console.error("Add schedule slot error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to add posting time."
      );
    } finally {
      setAddingDay(null);
    }
  }

  async function updateSlot(id: string, updates: Partial<ScheduleSlot>) {
    try {
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from("schedule_slots")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      setSlots((current) =>
        current.map((slot) =>
          slot.id === id
            ? {
                ...slot,
                ...updates,
              }
            : slot
        )
      );

      setSuccess("Posting time updated.");
    } catch (err) {
      console.error("Update schedule slot error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to update posting time."
      );
    }
  }

  async function deleteSlot(id: string) {
    const confirmed = window.confirm("Remove this posting time?");

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from("schedule_slots")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        throw deleteError;
      }

      setSlots((current) => current.filter((slot) => slot.id !== id));

      setSuccess("Posting time removed.");
    } catch (err) {
      console.error("Delete schedule slot error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to remove posting time."
      );
    }
  }

  function getSlotsForDay(day: number) {
    return slots
      .filter((slot) => slot.day_of_week === day && slot.enabled)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen">
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:px-10">
            <div className="h-10 w-48 animate-pulse rounded-xl bg-white/10" />
            <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-white/10" />
            <div className="mt-10 space-y-6">
              <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
              <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
          {/* COLORFUL STUDIO SETTINGS HEADER */}
          <div
            className="mb-8 rounded-3xl border p-6 sm:p-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,92,255,0.18) 0%, var(--card) 52%, rgba(56,189,248,0.14) 100%)",
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[#C4B5FD]">
              ⚙ Postoll Studio Preferences
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-tight sm:text-4xl">
              Settings
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Manage your Postoll account, password, schedule slots, and
              automatic publishing preferences.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5 text-xs font-bold">
              <span
                className={`rounded-full border px-3.5 py-1 ${
                  automaticScheduling
                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                    : "border-white/15 bg-white/5 text-neutral-300"
                }`}
              >
                Autopilot: {automaticScheduling ? "Enabled" : "Paused"}
              </span>
              <span className="rounded-full border border-[#7C5CFF]/35 bg-[#7C5CFF]/15 px-3.5 py-1 text-[#C4B5FD]">
                {timezone}
              </span>
              <span className="rounded-full border border-sky-400/35 bg-sky-500/15 px-3.5 py-1 text-sky-300">
                {slots.length} {slots.length === 1 ? "Slot" : "Slots"}
              </span>
            </div>
          </div>

          {success && (
            <div className="mb-6 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ACCOUNT & PASSWORD */}
          <section
            className="mb-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-4">
              <h2 className="text-lg font-bold">Update password</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Change the password for your account
                {userEmail ? ` (${userEmail})` : ""}.
              </p>
            </div>

            {passwordError && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateAccountPassword} className="space-y-4">
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
                  className={`flex items-center gap-2 ${
                    pwChecks.minLength ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{pwChecks.minLength ? "✓" : "○"}</span>
                  <span>At least 8 characters</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    pwChecks.hasAlphabet
                      ? "text-emerald-400"
                      : "text-neutral-400"
                  }`}
                >
                  <span>{pwChecks.hasAlphabet ? "✓" : "○"}</span>
                  <span>Contains an alphabet letter (A–Z)</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    pwChecks.hasNumber ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{pwChecks.hasNumber ? "✓" : "○"}</span>
                  <span>Contains 1 or more numbers (0–9)</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    pwChecks.hasSpecial
                      ? "text-emerald-400"
                      : "text-neutral-400"
                  }`}
                >
                  <span>{pwChecks.hasSpecial ? "✓" : "○"}</span>
                  <span>
                    Contains 1 or more special characters (!@#$%^&amp;*)
                  </span>
                </li>
              </ul>

              <div>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
                >
                  {updatingPassword ? "Updating password..." : "Update password"}
                </button>
              </div>
            </form>
          </section>

          {/* AUTOMATIC SCHEDULING */}
          <section
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl text-[#C4B5FD]"
                  style={{ background: "rgba(124, 92, 255, 0.16)" }}
                >
                  ⚡
                </div>

                <div>
                  <h2 className="text-lg font-bold">Automatic scheduling</h2>
                  <p
                    className="mt-1 max-w-2xl text-sm leading-6"
                    style={{ color: "var(--muted)" }}
                  >
                    Let Postoll automatically choose the next available posting
                    slot for your approved content.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleAutomaticScheduling}
                disabled={saving}
                aria-label="Toggle automatic scheduling"
                className="flex shrink-0 items-center gap-3"
              >
                <span
                  className={`relative h-8 w-14 rounded-full transition ${
                    automaticScheduling ? "bg-[#7C5CFF]" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                      automaticScheduling ? "left-7" : "left-1"
                    }`}
                  />
                </span>

                <span className="text-sm font-bold">
                  {automaticScheduling ? "On" : "Off"}
                </span>
              </button>
            </div>
          </section>

          {/* TIMEZONE */}
          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold">Timezone</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Postoll will use this timezone when calculating automatic
                  publishing times.
                </p>
              </div>

              <select
                value={timezone}
                onChange={(event) => changeTimezone(event.target.value)}
                className="rounded-xl border px-4 py-3 text-sm outline-none"
                style={{
                  minWidth: "220px",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                }}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* POSTING DAYS */}
          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div>
              <h2 className="text-lg font-bold">Posting days</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Choose the days when Postoll can automatically schedule your
                content.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {DAYS.map((day) => {
                const selected = selectedDays.includes(day.value);

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    disabled={saving}
                    className="rounded-xl border px-4 py-4 text-sm font-bold transition"
                    style={{
                      borderColor: selected ? "#7C5CFF" : "var(--border)",
                      background: selected
                        ? "rgba(124, 92, 255, 0.16)"
                        : "transparent",
                      color: selected ? "#C4B5FD" : "var(--foreground)",
                    }}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </section>

          {/* POSTING TIMES */}
          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-bold">Posting times</h2>
                <p
                  className="mt-1 text-sm leading-6"
                  style={{ color: "var(--muted)" }}
                >
                  Add one or more automatic scheduling slots for each day. You
                  can have different times for posts and reels.
                </p>
              </div>

              <div
                className="rounded-full px-3.5 py-1.5 text-xs font-bold"
                style={{
                  background: "rgba(124, 92, 255, 0.14)",
                  color: "#C4B5FD",
                }}
              >
                {slots.length} {slots.length === 1 ? "slot" : "slots"}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {DAYS.map((day) => {
                const daySlots = getSlotsForDay(day.value);
                const selected = selectedDays.includes(day.value);

                return (
                  <div
                    key={day.key}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: selected
                        ? "rgba(124, 92, 255, 0.4)"
                        : "var(--border)",
                      background: selected
                        ? "rgba(124, 92, 255, 0.04)"
                        : "transparent",
                    }}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
                          style={{
                            background: selected
                              ? "rgba(124, 92, 255, 0.18)"
                              : "rgba(255,255,255,0.05)",
                            color: selected ? "#C4B5FD" : "var(--muted)",
                          }}
                        >
                          {day.short}
                        </div>

                        <div>
                          <p className="text-sm font-bold">{day.label}</p>
                          <p
                            className="mt-0.5 text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            {daySlots.length === 0
                              ? "No posting times"
                              : `${daySlots.length} ${
                                  daySlots.length === 1
                                    ? "posting time"
                                    : "posting times"
                                }`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addSlot(day.value)}
                        disabled={addingDay === day.value}
                        className="rounded-xl border px-3.5 py-2 text-xs font-bold transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {addingDay === day.value ? "Adding..." : "+ Add time"}
                      </button>
                    </div>

                    {daySlots.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                            style={{
                              borderColor: "var(--border)",
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            <input
                              type="time"
                              value={slot.time.slice(0, 5)}
                              onChange={(event) =>
                                updateSlot(slot.id, {
                                  time: event.target.value,
                                })
                              }
                              className="rounded-lg border px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--background)",
                                color: "var(--foreground)",
                                borderColor: "var(--border)",
                              }}
                            />

                            <select
                              value={slot.content_type}
                              onChange={(event) =>
                                updateSlot(slot.id, {
                                  content_type: event.target.value as
                                    | "all"
                                    | "post"
                                    | "reel",
                                })
                              }
                              className="rounded-lg border px-3 py-2 text-sm outline-none"
                              style={{
                                background: "var(--background)",
                                color: "var(--foreground)",
                                borderColor: "var(--border)",
                              }}
                            >
                              <option value="all">All content</option>
                              <option value="post">Posts only</option>
                              <option value="reel">Reels only</option>
                            </select>

                            <div className="flex-1">
                              <span
                                className="text-sm font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {formatTime(slot.time)}
                              </span>

                              <span
                                className="ml-2 text-xs"
                                style={{ color: "var(--muted)" }}
                              >
                                {slot.content_type === "all"
                                  ? "All content"
                                  : slot.content_type === "post"
                                  ? "Post"
                                  : "Reel"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => deleteSlot(slot.id)}
                              className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                              style={{ borderColor: "rgba(239,68,68,0.2)" }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {daySlots.length === 0 && (
                      <div
                        className="mt-4 rounded-lg border border-dashed px-4 py-5 text-center text-xs"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--muted)",
                        }}
                      >
                        No automatic posting time configured for {day.label}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h2 className="text-lg font-bold">How automatic scheduling works</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFF]/20 text-xs font-black text-[#C4B5FD]">
                  1
                </div>
                <p className="mt-3 text-sm font-bold">Create content</p>
                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--muted)" }}
                >
                  Create posts and reels in Postoll and approve them.
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EC4899]/20 text-xs font-black text-[#F9A8D4]">
                  2
                </div>
                <p className="mt-3 text-sm font-bold">Postoll finds a slot</p>
                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--muted)" }}
                >
                  Postoll looks at your selected days and available times.
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-black text-emerald-300">
                  3
                </div>
                <p className="mt-3 text-sm font-bold">Content gets scheduled</p>
                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--muted)" }}
                >
                  The selected slot will become the content&apos;s scheduled
                  publishing time.
                </p>
              </div>
            </div>
          </section>

          {/* API KEYS (n8n / webhook ingest) */}
          <section
            className="mt-10 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h2 className="text-lg font-bold">Ingest API keys</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              For n8n, Zapier, or any tool that sends videos into Postoll.
              Header:{" "}
              <code className="text-xs">Authorization: Bearer pk_live_…</code>
            </p>

            {apiKeyError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {apiKeyError}
              </div>
            )}

            {apiKeySecretOnce && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-200">
                  Copy this key now — it will not be shown again.
                </p>
                <code className="mt-3 block break-all rounded-lg bg-black/40 p-3 text-xs sm:text-sm">
                  {apiKeySecretOnce}
                </code>
                <button
                  type="button"
                  className="mt-3 rounded-lg border px-3 py-1.5 text-sm"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => navigator.clipboard.writeText(apiKeySecretOnce)}
                >
                  Copy
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="Key name"
                className="rounded-xl border px-3.5 py-2 text-sm"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                }}
              />
              <button
                type="button"
                disabled={apiKeyCreating}
                onClick={createApiKey}
                className="rounded-xl bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
              >
                {apiKeyCreating ? "Creating…" : "Create API key"}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {apiKeysLoading && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Loading keys…
                </p>
              )}
              {!apiKeysLoading && apiKeys.length === 0 && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  No API keys yet.
                </p>
              )}
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {k.key_prefix}… · {new Date(k.created_at).toLocaleString()}
                      {k.last_used_at
                        ? ` · last used ${new Date(
                            k.last_used_at
                          ).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeApiKey(k.id)}
                    className="rounded-lg border px-3 py-1.5 text-sm text-red-400"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>

            <div
              className="mt-6 rounded-xl border border-dashed p-4 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="font-medium">Webhook URL</p>
              <code className="mt-2 block break-all text-xs">
                https://postoll.vercel.app/api/ingest/webhook
              </code>
            </div>
          </section>

          {/* BOTTOM STATUS */}
          <div
            className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <p className="text-sm font-medium">
                Automatic scheduling{" "}
                {automaticScheduling ? "enabled" : "disabled"}
              </p>

              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {selectedDays.length} posting{" "}
                {selectedDays.length === 1 ? "day" : "days"} selected ·{" "}
                {slots.length} recurring {slots.length === 1 ? "slot" : "slots"}
              </p>
            </div>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-white/[0.05] disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

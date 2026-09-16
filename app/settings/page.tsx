"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

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
  {
    key: "monday",
    label: "Monday",
    short: "Mon",
    value: 1,
  },
  {
    key: "tuesday",
    label: "Tuesday",
    short: "Tue",
    value: 2,
  },
  {
    key: "wednesday",
    label: "Wednesday",
    short: "Wed",
    value: 3,
  },
  {
    key: "thursday",
    label: "Thursday",
    short: "Thu",
    value: 4,
  },
  {
    key: "friday",
    label: "Friday",
    short: "Fri",
    value: 5,
  },
  {
    key: "saturday",
    label: "Saturday",
    short: "Sat",
    value: 6,
  },
  {
    key: "sunday",
    label: "Sunday",
    short: "Sun",
    value: 0,
  },
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

  const [automaticScheduling, setAutomaticScheduling] =
    useState(false);

  const [timezone, setTimezone] =
    useState("Asia/Kolkata");

  const [selectedDays, setSelectedDays] =
    useState<number[]>([
      1,
      2,
      3,
      4,
      5,
    ]);

  const [slots, setSlots] =
    useState<ScheduleSlot[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [addingDay, setAddingDay] =
    useState<number | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  /*
   * --------------------------------------------------
   * LOAD SETTINGS
   * --------------------------------------------------
   */

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
        throw new Error(
          "Please log in to manage scheduling settings."
        );
      }

      setUserId(user.id);

      /*
       * Load existing schedule settings.
       */

      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from("schedule_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      if (settings) {
        if (
          typeof settings.automatic_scheduling ===
          "boolean"
        ) {
          setAutomaticScheduling(
            settings.automatic_scheduling
          );
        }

        if (
          typeof settings.timezone ===
          "string" &&
          settings.timezone
        ) {
          setTimezone(settings.timezone);
        }

        if (
          Array.isArray(settings.posting_days)
        ) {
          setSelectedDays(
            settings.posting_days
              .map((day: unknown) =>
                Number(day)
              )
              .filter(
                (day: number) =>
                  day >= 0 && day <= 6
              )
          );
        }
      }

      /*
       * Load recurring time slots.
       */

      const {
        data: slotData,
        error: slotsError,
      } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week", {
          ascending: true,
        })
        .order("time", {
          ascending: true,
        });

      if (slotsError) {
        throw slotsError;
      }

      setSlots(
        (slotData as ScheduleSlot[]) || []
      );
    } catch (err) {
      console.error(
        "Load schedule settings error:",
        err
      );

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

  /*
   * --------------------------------------------------
   * SAVE MAIN SETTINGS
   * --------------------------------------------------
   */

  async function saveMainSettings(
    updates: Record<string, unknown>
  ) {
    if (!userId) {
      throw new Error(
        "You must be logged in."
      );
    }

    /*
     * Try to update the existing row first.
     */

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("schedule_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const {
        error: updateError,
      } = await supabase
        .from("schedule_settings")
        .update(updates)
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    /*
     * No settings row exists yet.
     */

    const {
      error: insertError,
    } = await supabase
      .from("schedule_settings")
      .insert({
        user_id: userId,
        ...updates,
      });

    if (insertError) {
      throw insertError;
    }
  }

  /*
   * --------------------------------------------------
   * TOGGLE AUTOMATIC SCHEDULING
   * --------------------------------------------------
   */

  async function toggleAutomaticScheduling() {
    const nextValue =
      !automaticScheduling;

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
      console.error(
        "Automatic scheduling update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update automatic scheduling."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * TOGGLE DAY
   * --------------------------------------------------
   */

  async function toggleDay(day: number) {
    const isSelected =
      selectedDays.includes(day);

    const nextDays = isSelected
      ? selectedDays.filter(
          (value) => value !== day
        )
      : [...selectedDays, day].sort(
          (a, b) => a - b
        );

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveMainSettings({
        posting_days: nextDays,
      });

      setSelectedDays(nextDays);

      setSuccess(
        "Posting days updated."
      );
    } catch (err) {
      console.error(
        "Posting days update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update posting days."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * CHANGE TIMEZONE
   * --------------------------------------------------
   */

  async function changeTimezone(
    nextTimezone: string
  ) {
    try {
      setTimezone(nextTimezone);
      setSaving(true);
      setError(null);
      setSuccess(null);

      await saveMainSettings({
        timezone: nextTimezone,
      });

      setSuccess(
        "Timezone updated."
      );
    } catch (err) {
      console.error(
        "Timezone update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update timezone."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * ADD SLOT
   * --------------------------------------------------
   */

  async function addSlot(
    dayOfWeek: number
  ) {
    if (!userId) {
      return;
    }

    try {
      setAddingDay(dayOfWeek);
      setError(null);
      setSuccess(null);

      /*
       * Default time.
       */

      const existingForDay =
        slots.filter(
          (slot) =>
            slot.day_of_week === dayOfWeek
        );

      let defaultTime = "09:00";

      if (existingForDay.length > 0) {
        const last =
          existingForDay[
            existingForDay.length - 1
          ];

        const [hour, minute] =
          last.time.split(":");

        let nextHour =
          Number(hour) + 2;

        if (nextHour > 23) {
          nextHour = 23;
        }

        defaultTime = `${String(
          nextHour
        ).padStart(2, "0")}:${minute}`;
      }

      const {
        data,
        error: insertError,
      } = await supabase
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
          [...current, data as ScheduleSlot].sort(
            (a, b) => {
              if (
                a.day_of_week !==
                b.day_of_week
              ) {
                return (
                  a.day_of_week -
                  b.day_of_week
                );
              }

              return a.time.localeCompare(
                b.time
              );
            }
          )
        );
      }

      setSuccess(
        "Posting time added."
      );
    } catch (err) {
      console.error(
        "Add schedule slot error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to add posting time."
      );
    } finally {
      setAddingDay(null);
    }
  }

  /*
   * --------------------------------------------------
   * UPDATE SLOT
   * --------------------------------------------------
   */

  async function updateSlot(
    id: string,
    updates: Partial<ScheduleSlot>
  ) {
    try {
      setError(null);
      setSuccess(null);

      const {
        error: updateError,
      } = await supabase
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

      setSuccess(
        "Posting time updated."
      );
    } catch (err) {
      console.error(
        "Update schedule slot error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update posting time."
      );
    }
  }

  /*
   * --------------------------------------------------
   * DELETE SLOT
   * --------------------------------------------------
   */

  async function deleteSlot(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Remove this posting time?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const {
        error: deleteError,
      } = await supabase
        .from("schedule_slots")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        throw deleteError;
      }

      setSlots((current) =>
        current.filter(
          (slot) => slot.id !== id
        )
      );

      setSuccess(
        "Posting time removed."
      );
    } catch (err) {
      console.error(
        "Delete schedule slot error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove posting time."
      );
    }
  }

  /*
   * --------------------------------------------------
   * GET SLOTS FOR DAY
   * --------------------------------------------------
   */

  function getSlotsForDay(
    day: number
  ) {
    return slots
      .filter(
        (slot) =>
          slot.day_of_week === day &&
          slot.enabled
      )
      .sort((a, b) =>
        a.time.localeCompare(b.time)
      );
  }

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (loading) {
    return (
      <AppShell>
        <main className="min-h-screen">
          <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
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

  /*
   * --------------------------------------------------
   * PAGE
   * --------------------------------------------------
   */

  return (
    <AppShell>
      <main className="min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">

          {/* HEADER */}

          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight">
              Settings
            </h1>

            <p
              className="mt-2 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Manage your Postoll account and
              automatic publishing preferences.
            </p>
          </div>

          {/* SUCCESS */}

          {success && (
            <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {success}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* ================================================= */}
          {/* AUTOMATIC SCHEDULING */}
          {/* ================================================= */}

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
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{
                    background:
                      "rgba(124,58,237,0.14)",
                  }}
                >
                  ⚡
                </div>

                <div>
                  <h2 className="text-lg font-semibold">
                    Automatic scheduling
                  </h2>

                  <p
                    className="mt-1 max-w-2xl text-sm leading-6"
                    style={{
                      color: "var(--muted)",
                    }}
                  >
                    Let Postoll automatically
                    choose the next available
                    posting slot for your approved
                    content.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  toggleAutomaticScheduling
                }
                disabled={saving}
                aria-label="Toggle automatic scheduling"
                className="flex shrink-0 items-center gap-3"
              >
                <span
                  className={`relative h-8 w-14 rounded-full transition ${
                    automaticScheduling
                      ? "bg-violet-600"
                      : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                      automaticScheduling
                        ? "left-7"
                        : "left-1"
                    }`}
                  />
                </span>

                <span className="text-sm font-medium">
                  {automaticScheduling
                    ? "On"
                    : "Off"}
                </span>
              </button>
            </div>
          </section>

          {/* ================================================= */}
          {/* TIMEZONE */}
          {/* ================================================= */}

          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="text-lg font-semibold">
                  Timezone
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Postoll will use this timezone
                  when calculating automatic
                  publishing times.
                </p>
              </div>

              <select
                value={timezone}
                onChange={(event) =>
                  changeTimezone(
                    event.target.value
                  )
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none"
                style={{
                  minWidth: "220px",
                  background:
                    "var(--background)",
                  color:
                    "var(--foreground)",
                  borderColor:
                    "var(--border)",
                }}
              >
                {TIMEZONES.map(
                  (zone) => (
                    <option
                      key={zone}
                      value={zone}
                    >
                      {zone}
                    </option>
                  )
                )}
              </select>
            </div>
          </section>

          {/* ================================================= */}
          {/* POSTING DAYS */}
          {/* ================================================= */}

          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">
                Posting days
              </h2>

              <p
                className="mt-1 text-sm"
                style={{
                  color: "var(--muted)",
                }}
              >
                Choose the days when Postoll can
                automatically schedule your content.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {DAYS.map((day) => {
                const selected =
                  selectedDays.includes(
                    day.value
                  );

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() =>
                      toggleDay(day.value)
                    }
                    disabled={saving}
                    className="rounded-xl border px-4 py-4 text-sm font-medium transition"
                    style={{
                      borderColor: selected
                        ? "#8b5cf6"
                        : "var(--border)",
                      background: selected
                        ? "rgba(124,58,237,0.12)"
                        : "transparent",
                      color: selected
                        ? "#c4b5fd"
                        : "var(--foreground)",
                    }}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ================================================= */}
          {/* POSTING TIMES */}
          {/* ================================================= */}

          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

              <div>
                <h2 className="text-lg font-semibold">
                  Posting times
                </h2>

                <p
                  className="mt-1 text-sm leading-6"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Add one or more automatic
                  scheduling slots for each day.
                  You can have different times for
                  posts and reels.
                </p>
              </div>

              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background:
                    "rgba(255,255,255,0.04)",
                  color: "var(--muted)",
                }}
              >
                {slots.length}{" "}
                {slots.length === 1
                  ? "slot"
                  : "slots"}
              </div>
            </div>

            {/* DAYS */}

            <div className="mt-8 space-y-4">
              {DAYS.map((day) => {
                const daySlots =
                  getSlotsForDay(
                    day.value
                  );

                const selected =
                  selectedDays.includes(
                    day.value
                  );

                return (
                  <div
                    key={day.key}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor:
                        selected
                          ? "rgba(139,92,246,0.35)"
                          : "var(--border)",
                      background:
                        selected
                          ? "rgba(124,58,237,0.03)"
                          : "transparent",
                    }}
                  >

                    {/* DAY HEADER */}

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div className="flex items-center gap-3">

                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold"
                          style={{
                            background:
                              selected
                                ? "rgba(124,58,237,0.14)"
                                : "rgba(255,255,255,0.04)",
                            color:
                              selected
                                ? "#c4b5fd"
                                : "var(--muted)",
                          }}
                        >
                          {day.short}
                        </div>

                        <div>
                          <p className="text-sm font-medium">
                            {day.label}
                          </p>

                          <p
                            className="mt-0.5 text-xs"
                            style={{
                              color:
                                "var(--muted)",
                            }}
                          >
                            {daySlots.length ===
                            0
                              ? "No posting times"
                              : `${daySlots.length} ${
                                  daySlots.length ===
                                  1
                                    ? "posting time"
                                    : "posting times"
                                }`}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          addSlot(
                            day.value
                          )
                        }
                        disabled={
                          addingDay ===
                          day.value
                        }
                        className="rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor:
                            "var(--border)",
                        }}
                      >
                        {addingDay ===
                        day.value
                          ? "Adding..."
                          : "+ Add time"}
                      </button>
                    </div>

                    {/* SLOT LIST */}

                    {daySlots.length > 0 && (
                      <div className="mt-4 space-y-2">

                        {daySlots.map(
                          (slot) => (
                            <div
                              key={
                                slot.id
                              }
                              className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                              style={{
                                borderColor:
                                  "var(--border)",
                                background:
                                  "rgba(255,255,255,0.02)",
                              }}
                            >

                              {/* TIME */}

                              <input
                                type="time"
                                value={slot.time.slice(
                                  0,
                                  5
                                )}
                                onChange={(
                                  event
                                ) =>
                                  updateSlot(
                                    slot.id,
                                    {
                                      time:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                className="rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{
                                  background:
                                    "var(--background)",
                                  color:
                                    "var(--foreground)",
                                  borderColor:
                                    "var(--border)",
                                }}
                              />

                              {/* CONTENT TYPE */}

                              <select
                                value={
                                  slot.content_type
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateSlot(
                                    slot.id,
                                    {
                                      content_type:
                                        event
                                          .target
                                          .value as
                                          | "all"
                                          | "post"
                                          | "reel",
                                    }
                                  )
                                }
                                className="rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{
                                  background:
                                    "var(--background)",
                                  color:
                                    "var(--foreground)",
                                  borderColor:
                                    "var(--border)",
                                }}
                              >
                                <option value="all">
                                  All content
                                </option>

                                <option value="post">
                                  Posts only
                                </option>

                                <option value="reel">
                                  Reels only
                                </option>
                              </select>

                              {/* PREVIEW */}

                              <div className="flex-1">
                                <span
                                  className="text-sm"
                                  style={{
                                    color:
                                      "var(--foreground)",
                                  }}
                                >
                                  {formatTime(
                                    slot.time
                                  )}
                                </span>

                                <span
                                  className="ml-2 text-xs"
                                  style={{
                                    color:
                                      "var(--muted)",
                                  }}
                                >
                                  {slot.content_type ===
                                  "all"
                                    ? "All content"
                                    : slot.content_type ===
                                      "post"
                                    ? "Post"
                                    : "Reel"}
                                </span>
                              </div>

                              {/* DELETE */}

                              <button
                                type="button"
                                onClick={() =>
                                  deleteSlot(
                                    slot.id
                                  )
                                }
                                className="rounded-lg border px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                                style={{
                                  borderColor:
                                    "rgba(239,68,68,0.15)",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* EMPTY */}

                    {daySlots.length ===
                      0 && (
                      <div
                        className="mt-4 rounded-lg border border-dashed px-4 py-5 text-center text-xs"
                        style={{
                          borderColor:
                            "var(--border)",
                          color:
                            "var(--muted)",
                        }}
                      >
                        No automatic posting
                        time configured for{" "}
                        {day.label}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================================================= */}
          {/* HOW IT WORKS */}
          {/* ================================================= */}

          <section
            className="mt-6 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h2 className="text-lg font-semibold">
              How automatic scheduling works
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor:
                    "var(--border)",
                }}
              >
                <div className="text-lg">
                  1️⃣
                </div>

                <p className="mt-3 text-sm font-medium">
                  Create content
                </p>

                <p
                  className="mt-1 text-xs leading-5"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Create posts and reels in
                  Postoll and approve them.
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor:
                    "var(--border)",
                }}
              >
                <div className="text-lg">
                  2️⃣
                </div>

                <p className="mt-3 text-sm font-medium">
                  Postoll finds a slot
                </p>

                <p
                  className="mt-1 text-xs leading-5"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Postoll looks at your selected
                  days and available times.
                </p>
              </div>

              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor:
                    "var(--border)",
                }}
              >
                <div className="text-lg">
                  3️⃣
                </div>

                <p className="mt-3 text-sm font-medium">
                  Content gets scheduled
                </p>

                <p
                  className="mt-1 text-xs leading-5"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  The selected slot will become
                  the content's scheduled publishing
                  time.
                </p>
              </div>
            </div>
          </section>

          {/* ================================================= */}
          {/* BOTTOM STATUS */}
          {/* ================================================= */}

          <div className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <div>
              <p className="text-sm font-medium">
                Automatic scheduling{" "}
                {automaticScheduling
                  ? "enabled"
                  : "disabled"}
              </p>

              <p
                className="mt-1 text-xs"
                style={{
                  color: "var(--muted)",
                }}
              >
                {selectedDays.length} posting{" "}
                {selectedDays.length === 1
                  ? "day"
                  : "days"}{" "}
                selected · {slots.length}{" "}
                recurring{" "}
                {slots.length === 1
                  ? "slot"
                  : "slots"}
              </p>
            </div>

            <button
              type="button"
              onClick={loadSettings}
              disabled={loading}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-white/[0.05] disabled:opacity-50"
              style={{
                borderColor:
                  "var(--border)",
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
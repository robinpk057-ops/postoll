"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

type CalendarPost = {
  id: string;
  platform: string | null;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string | null;
  media_url: string;
  thumbnail_url?: string | null;
  caption: string | null;
  status: string;
  account_id: string | null;
  account_name?: string | null;
  published_at?: string | null;
  created_at?: string;
};

type SocialAccount = {
  id: string;
  platform: string;
  account_name: string | null;
  account_id?: string | null;
  connected?: boolean | null;
};

const EXCLUDED_PLATFORMS = new Set(["x", "twitter"]);

function isAllowedAccount(acc: SocialAccount) {
  const p = (acc.platform || "").trim().toLowerCase();
  if (!p || EXCLUDED_PLATFORMS.has(p)) return false;
  return acc.connected !== false;
}

function isVideoMedia(url: string) {
  return /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(url || "");
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCurrentTimeHHMMInTz(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value || "09";
    const m = parts.find((p) => p.type === "minute")?.value || "00";
    return `${h === "24" ? "00" : h}:${m}`;
  } catch {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
  }
}

function buildDays(count: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function MediaThumbnail({
  src,
  thumbnailUrl,
  sizeClass = "h-12 w-12",
}: {
  src: string;
  thumbnailUrl?: string | null;
  sizeClass?: string;
}) {
  const previewSrc = thumbnailUrl || src;
  const isVideo = !thumbnailUrl && isVideoMedia(src);

  if (!previewSrc) {
    return (
      <div
        className={`${sizeClass} shrink-0 rounded bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400`}
      >
        Media
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={`${src}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        className={`${sizeClass} shrink-0 rounded bg-zinc-900 object-cover`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewSrc}
      alt=""
      className={`${sizeClass} shrink-0 rounded bg-zinc-900 object-cover`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "scheduled").toLowerCase();
  const isPosted =
    s === "published" || s === "posted" || s === "completed" || s === "success";
  const isFailed = s === "failed" || s === "error";

  let style = {
    bg: "rgba(124, 58, 237, 0.16)",
    border: "rgba(167, 139, 250, 0.35)",
    text: "#c4b5fd",
  };

  if (isPosted) {
    style = {
      bg: "rgba(16, 185, 129, 0.16)",
      border: "rgba(52, 211, 153, 0.35)",
      text: "#6ee7b7",
    };
  } else if (isFailed) {
    style = {
      bg: "rgba(239, 68, 68, 0.16)",
      border: "rgba(248, 113, 113, 0.35)",
      text: "#fca5a5",
    };
  }

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      {status}
    </span>
  );
}

function TimePicker24({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [h, m] = (value || "09:00").split(":");
  const hour = Number(h) || 0;
  const minute = Number(m) || 0;

  function set(h2: number, m2: number) {
    onChange(
      `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={hour}
        onChange={(e) => set(Number(e.target.value), minute)}
        className="rounded-lg border px-3 py-2 text-sm text-white"
        style={{ background: "#0b0b0f", borderColor: "#2e2e38" }}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {String(i).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        value={minute}
        onChange={(e) => set(hour, Number(e.target.value))}
        className="rounded-lg border px-3 py-2 text-sm text-white"
        style={{ background: "#0b0b0f", borderColor: "#2e2e38" }}
      >
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>
            {String(i).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CalendarPage() {
  const supabase = createClient();
  const days = useMemo(() => buildDays(30), []);
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "posted" | "scheduled" | "failed"
  >("all");

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [caption, setCaption] = useState("");
  const [time, setTime] = useState("09:00");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const isSelectedTimePastToday = useMemo(() => {
    if (modalDate !== todayKey) return false;
    const nowHHMM = getCurrentTimeHHMMInTz(timezone);
    return time < nowHHMM;
  }, [modalDate, todayKey, time, timezone]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [postsRes, accRes] = await Promise.all([
        fetch("/api/calendar/posts"),
        fetch("/api/accounts"),
      ]);
      const postsJson = await postsRes.json().catch(() => ({}));
      const accJson = await accRes.json().catch(() => ({}));

      if (!postsRes.ok) {
        throw new Error(postsJson.error || "Failed to load posts");
      }

      setPosts(postsJson.posts || []);

      const rawList =
        accJson.accounts ?? accJson.data ?? (Array.isArray(accJson) ? accJson : []);
      const filtered = (Array.isArray(rawList) ? rawList : []).filter(
        isAllowedAccount
      );

      setAccounts(filtered);
      setSelectedAccountIds((prev) => {
        const validPrev = prev.filter((id) =>
          filtered.some((a) => a.id === id)
        );
        if (validPrev.length > 0) return validPrev;
        return filtered.length > 0 ? [filtered[0].id] : [];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openModalForDate(dateKey: string) {
    setError("");
    setFile(null);
    if (dateKey === todayKey) {
      setTime(getCurrentTimeHHMMInTz(timezone));
    } else {
      setTime("09:00");
    }
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds([accounts[0].id]);
    }
    setModalDate(dateKey);
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const allSelected =
    accounts.length > 0 && selectedAccountIds.length === accounts.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  }

  const calendarDayKeys = useMemo(
    () => new Set(days.map((d) => toDateKey(d))),
    [days]
  );

  function postsForDay(dateKey: string) {
    return posts.filter((p) => p.scheduled_date === dateKey);
  }

  const filteredHistoryPosts = useMemo(() => {
    return posts.filter((p) => {
      const s = (p.status || "").toLowerCase();
      if (historyFilter === "posted") {
        return (
          s === "published" ||
          s === "posted" ||
          s === "completed" ||
          s === "success"
        );
      }
      if (historyFilter === "scheduled") {
        return s === "scheduled" || s === "queued";
      }
      if (historyFilter === "failed") {
        return s === "failed" || s === "error";
      }
      return true;
    });
  }, [posts, historyFilter]);

  async function submitPost() {
    if (!modalDate || !file) return;
    if (selectedAccountIds.length === 0) {
      setError("Select at least one account to schedule.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/calendar/${modalDate}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("postoll-media")
        .upload(path, file, { upsert: false });

      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("postoll-media").getPublicUrl(path);

      const chosenAccounts = accounts.filter((a) =>
        selectedAccountIds.includes(a.id)
      );

      let anyAdjusted = false;
      let scheduledTimeUsed = time;

      const results = await Promise.all(
        chosenAccounts.map(async (acc) => {
          const res = await fetch("/api/calendar/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduled_date: modalDate,
              scheduled_time: time.length === 5 ? `${time}:00` : time,
              timezone,
              media_url: publicUrl,
              caption,
              account_id: acc.id,
              platform: acc.platform.toLowerCase(),
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              json.error || `Failed to schedule on ${acc.platform}`
            );
          }
          if (json.adjustedFromPastTime) {
            anyAdjusted = true;
            if (json.post?.scheduled_time) {
              scheduledTimeUsed = String(json.post.scheduled_time).slice(0, 5);
            }
          }
          return json;
        })
      );

      if (!results.length) {
        throw new Error("No posts scheduled");
      }

      if (anyAdjusted) {
        setNotice(
          `Selected time had already passed for today—scheduled once for the next coming time (${scheduledTimeUsed}) on ${modalDate}.`
        );
      } else {
        setNotice(
          `Scheduled once for ${modalDate} at ${time} (${results.length} account${results.length > 1 ? "s" : ""}).`
        );
      }

      setModalDate(null);
      setFile(null);
      setCaption("");
      setTime("09:00");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
          ✦ Medium plan
        </p>
        <h1 className="mt-2 text-4xl font-bold">Calendar</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          Rolling 30-day schedule · one-time per post (no repeats) · past times
          today move to next coming time · 24-hour ({timezone})
        </p>

        {notice && (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              borderColor: "rgba(52, 211, 153, 0.35)",
              color: "#6ee7b7",
            }}
          >
            {notice}
          </div>
        )}

        {error && !modalDate && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {accounts.length === 0 && !loading && (
          <div
            className="mt-6 rounded-xl border p-4"
            style={{ background: "#141419", borderColor: "#2e2e38" }}
          >
            <p className="text-sm">No eligible social accounts connected.</p>
            <Link
              href="/accounts"
              className="mt-2 inline-block text-sm font-medium"
              style={{ color: "#a78bfa" }}
            >
              Connect an account →
            </Link>
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </p>
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {days.map((d) => {
                const key = toDateKey(d);
                const dayPosts = postsForDay(key);
                const label = d.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={key}
                    className="flex min-h-40 flex-col rounded-2xl border p-4"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-semibold">{label}</p>
                      <button
                        type="button"
                        onClick={() => openModalForDate(key)}
                        className="rounded-lg px-2 py-1 text-xs font-medium"
                        style={{
                          background: "var(--foreground)",
                          color: "var(--background)",
                        }}
                      >
                        + Add
                      </button>
                    </div>

                    <div className="mt-3 flex-1 space-y-2">
                      {dayPosts.length === 0 && (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          No posts
                        </p>
                      )}
                      {dayPosts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2.5 rounded-lg border p-2"
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <MediaThumbnail
                            src={p.media_url}
                            thumbnailUrl={p.thumbnail_url}
                            sizeClass="h-12 w-12"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {(p.scheduled_time || "").slice(0, 5)}
                              {p.platform ? ` · ${p.platform}` : ""}
                            </p>
                            <div className="mt-0.5">
                              <StatusBadge status={p.status} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scheduled & Posted Content History (persists beyond rolling 30-day cards) */}
            <section
              className="mt-14 rounded-2xl border p-6"
              style={{
                backgroundColor: "#14141b",
                borderColor: "#2a2a36",
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    Scheduled &amp; Posted Content History
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    View all scheduled and already-published posts, accounts,
                    times, and status—even after dates roll past the 30-day grid.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All"],
                      ["posted", "Posted"],
                      ["scheduled", "Scheduled"],
                      ["failed", "Failed"],
                    ] as const
                  ).map(([key, label]) => {
                    const active = historyFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setHistoryFilter(key)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                        style={{
                          backgroundColor: active ? "#7c3aed" : "#1b1b24",
                          borderColor: active ? "#8b5cf6" : "#2f2f3d",
                          color: active ? "#ffffff" : "#d4d4d8",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredHistoryPosts.length === 0 ? (
                <p
                  className="mt-6 text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  No posts found for this filter.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {filteredHistoryPosts.map((item) => {
                    const outsideRolling30 = !calendarDayKeys.has(
                      item.scheduled_date
                    );
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        style={{
                          backgroundColor: "#0e0e13",
                          borderColor: "#262632",
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <MediaThumbnail
                            src={item.media_url}
                            thumbnailUrl={item.thumbnail_url}
                            sizeClass="h-14 w-14"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {item.caption || "(No caption)"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                              <span className="font-medium text-zinc-200">
                                {item.account_name || item.platform}
                              </span>
                              {item.platform ? ` (${item.platform})` : ""} ·
                              Scheduled:{" "}
                              <span className="text-zinc-200">
                                {item.scheduled_date}{" "}
                                {(item.scheduled_time || "").slice(0, 5)}
                              </span>
                              {item.timezone ? ` ${item.timezone}` : ""}
                            </p>
                            {item.published_at && (
                              <p className="mt-0.5 text-[11px] text-emerald-400">
                                Published at:{" "}
                                {new Date(item.published_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                          {outsideRolling30 && (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                              Outside 30d window
                            </span>
                          )}
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {modalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: "#15151c",
              borderColor: "#2f2f3d",
              color: "#f4f4f6",
            }}
          >
            <h2 className="text-xl font-semibold">Add post · {modalDate}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Posts once on the selected date &amp; time (no repeated runs).
            </p>

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <label className="mt-5 block text-sm font-medium">Media</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) setFile(dropped);
              }}
              className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3.5 transition hover:border-violet-400"
              style={{
                backgroundColor: "#0d0d12",
                borderColor: file ? "#7c3aed" : "#383847",
              }}
            >
              <div className="min-w-0 flex-1">
                {file ? (
                  <>
                    <p className="truncate text-sm font-medium text-white">
                      {file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB · Click to
                      replace
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-zinc-200">
                      Click to upload or drag &amp; drop
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Supports images and videos
                    </p>
                  </>
                )}
              </div>
              <span
                className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "#1f1f29",
                  borderColor: "#383847",
                  color: "#c4b5fd",
                }}
              >
                {file ? "Change" : "Choose file"}
              </span>
            </div>

            <label className="mt-4 block text-sm font-medium">Time (24h)</label>
            <div className="mt-2">
              <TimePicker24 value={time} onChange={setTime} />
            </div>
            {isSelectedTimePastToday && (
              <p className="mt-2 text-xs text-amber-300">
                This time has already passed today—saving will automatically set
                the next coming time today.
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                Accounts ({selectedAccountIds.length} selected)
              </span>
              {accounts.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: "#1f1f29",
                    borderColor: "#383847",
                    color: "#c4b5fd",
                  }}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            <div
              className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border p-3"
              style={{
                backgroundColor: "#0d0d12",
                borderColor: "#282834",
              }}
            >
              {accounts.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No accounts available (X is excluded).
                </p>
              ) : (
                accounts.map((acc) => {
                  const checked = selectedAccountIds.includes(acc.id);
                  return (
                    <label
                      key={acc.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition"
                      style={{
                        backgroundColor: checked ? "#1d1b2e" : "#14141c",
                        borderColor: checked ? "#7c3aed" : "#262632",
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccount(acc.id)}
                          className="h-4 w-4 accent-violet-500"
                        />
                        <span className="truncate font-medium">
                          {acc.account_name || acc.id}
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-300">
                        {acc.platform}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <Link
              href="/accounts"
              className="mt-2 inline-block text-xs"
              style={{ color: "#a78bfa" }}
            >
              Connect another account →
            </Link>

            <label className="mt-4 block text-sm font-medium">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-2 min-h-24 w-full rounded-lg border p-3 text-sm"
              style={{
                backgroundColor: "#0d0d12",
                borderColor: "#2e2e38",
                color: "#f4f4f6",
              }}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalDate(null)}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{
                  backgroundColor: "#1d1d26",
                  borderColor: "#343442",
                  color: "#f4f4f6",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || selectedAccountIds.length === 0 || saving}
                onClick={submitPost}
                className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                }}
              >
                {saving
                  ? "Saving…"
                  : `Schedule${selectedAccountIds.length > 1 ? ` (${selectedAccountIds.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
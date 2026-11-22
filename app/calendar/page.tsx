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

type DayGroup = {
  dateKey: string;
  posts: CalendarPost[];
  postedCount: number;
  scheduledCount: number;
  failedCount: number;
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

function isPostedStatus(status: string) {
  const s = (status || "").toLowerCase();
  return (
    s === "published" || s === "posted" || s === "completed" || s === "success"
  );
}

function isScheduledStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "scheduled" || s === "queued";
}

function isFailedStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "failed" || s === "error";
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
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-400`}
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
  const isPosted = isPostedStatus(status);
  const isFailed = isFailedStatus(status);

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
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize"
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "posted" | "scheduled" | "failed"
  >("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [expandedDayKeys, setExpandedDayKeys] = useState<Record<string, boolean>>(
    {}
  );
  const [visibleDayCount, setVisibleDayCount] = useState<number>(10);

  // Modal & media state (supports default file, existing media URL on reschedule, and per-account files)
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reusedMediaUrl, setReusedMediaUrl] = useState<string | null>(null);
  const [perAccountFiles, setPerAccountFiles] = useState<
    Record<string, File | null>
  >({});
  const [usePerAccountFiles, setUsePerAccountFiles] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const accountFileInputRefs = useRef<Record<string, HTMLInputElement | null>>(
    {}
  );

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

      const loadedPosts: CalendarPost[] = postsJson.posts || [];
      setPosts(loadedPosts);

      const firstDate = loadedPosts[0]?.scheduled_date;
      if (firstDate) {
        setExpandedDayKeys((prev) =>
          Object.keys(prev).length === 0 ? { [firstDate]: true } : prev
        );
      }

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
    setReusedMediaUrl(null);
    setPerAccountFiles({});
    setUsePerAccountFiles(false);
    setCaption("");
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

  function openRescheduleModal(post: CalendarPost) {
    setError("");
    setFile(null);
    setPerAccountFiles({});
    setUsePerAccountFiles(false);
    setReusedMediaUrl(post.media_url || null);
    setCaption(post.caption || "");
    const targetDate = post.scheduled_date || todayKey;
    const postTime = (post.scheduled_time || "09:00").slice(0, 5);
    setTime(postTime);
    if (post.account_id) {
      setSelectedAccountIds([post.account_id]);
    } else if (accounts[0]?.id) {
      setSelectedAccountIds([accounts[0].id]);
    }
    setModalDate(targetDate);
  }

  async function handleDeletePost(post: CalendarPost) {
    setDeletingId(post.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/calendar/posts?id=${encodeURIComponent(post.id)}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete post");
      }
      setNotice(
        `Deleted ${post.platform || "post"} scheduled for ${post.scheduled_date} ${(post.scheduled_time || "").slice(0, 5)}.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
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

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const p of posts) {
      if (p.scheduled_date && p.scheduled_date.length >= 7) {
        months.add(p.scheduled_date.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [posts]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const filteredPosts = posts.filter((p) => {
      if (
        selectedMonth !== "all" &&
        !(p.scheduled_date || "").startsWith(selectedMonth)
      ) {
        return false;
      }
      if (historyFilter === "posted") return isPostedStatus(p.status);
      if (historyFilter === "scheduled") return isScheduledStatus(p.status);
      if (historyFilter === "failed") return isFailedStatus(p.status);
      return true;
    });

    const groupedMap = new Map<string, CalendarPost[]>();
    for (const p of filteredPosts) {
      const key = p.scheduled_date || "unknown";
      const existing = groupedMap.get(key) || [];
      existing.push(p);
      groupedMap.set(key, existing);
    }

    return Array.from(groupedMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayItems]) => {
        const sortedItems = [...dayItems].sort((a, b) =>
          (b.scheduled_time || "").localeCompare(a.scheduled_time || "")
        );
        return {
          dateKey,
          posts: sortedItems,
          postedCount: sortedItems.filter((x) => isPostedStatus(x.status)).length,
          scheduledCount: sortedItems.filter((x) => isScheduledStatus(x.status))
            .length,
          failedCount: sortedItems.filter((x) => isFailedStatus(x.status)).length,
        };
      });
  }, [posts, selectedMonth, historyFilter]);

  const paginatedDayGroups = useMemo(
    () => dayGroups.slice(0, visibleDayCount),
    [dayGroups, visibleDayCount]
  );

  function toggleDayAccordion(dateKey: string) {
    setExpandedDayKeys((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  }

  async function uploadMediaFile(
    userId: string,
    dateKey: string,
    targetFile: File,
    suffix: string
  ) {
    const ext = targetFile.name.split(".").pop() || "bin";
    const path = `${userId}/calendar/${dateKey}/${Date.now()}-${suffix}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("postoll-media")
      .upload(path, targetFile, { upsert: false });

    if (upErr) throw upErr;

    const {
      data: { publicUrl },
    } = supabase.storage.from("postoll-media").getPublicUrl(path);

    return publicUrl;
  }

  const chosenAccounts = useMemo(
    () => accounts.filter((a) => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds]
  );

  const canSubmit = useMemo(() => {
    if (!modalDate || selectedAccountIds.length === 0 || saving) return false;
    if (file || reusedMediaUrl) return true;
    if (usePerAccountFiles) {
      return chosenAccounts.some((acc) => Boolean(perAccountFiles[acc.id]));
    }
    return false;
  }, [
    modalDate,
    selectedAccountIds.length,
    saving,
    file,
    reusedMediaUrl,
    usePerAccountFiles,
    chosenAccounts,
    perAccountFiles,
  ]);

  async function submitPost() {
    if (!modalDate || !canSubmit) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      let defaultUrl: string | null = reusedMediaUrl;
      if (file) {
        defaultUrl = await uploadMediaFile(user.id, modalDate, file, "default");
      }

      const accountUrlMap = new Map<string, string>();
      if (usePerAccountFiles) {
        for (const acc of chosenAccounts) {
          const customFile = perAccountFiles[acc.id];
          if (customFile) {
            const uploadedUrl = await uploadMediaFile(
              user.id,
              modalDate,
              customFile,
              acc.platform.toLowerCase()
            );
            accountUrlMap.set(acc.id, uploadedUrl);
          }
        }
      }

      let anyAdjusted = false;
      let scheduledTimeUsed = time;
      let scheduledCount = 0;

      for (const acc of chosenAccounts) {
        const mediaUrlForAccount = accountUrlMap.get(acc.id) || defaultUrl;
        if (!mediaUrlForAccount) {
          throw new Error(
            `Please select a file for ${acc.account_name || acc.platform} or upload a default file.`
          );
        }

        const res = await fetch("/api/calendar/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_date: modalDate,
            scheduled_time: time.length === 5 ? `${time}:00` : time,
            timezone,
            media_url: mediaUrlForAccount,
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
        scheduledCount += 1;
        if (json.adjustedFromPastTime) {
          anyAdjusted = true;
          if (json.post?.scheduled_time) {
            scheduledTimeUsed = String(json.post.scheduled_time).slice(0, 5);
          }
        }
      }

      if (anyAdjusted) {
        setNotice(
          `Selected time had already passed for today—scheduled once for the next coming time (${scheduledTimeUsed}) on ${modalDate}.`
        );
      } else {
        setNotice(
          `Scheduled once for ${modalDate} at ${time} (${scheduledCount} account${scheduledCount > 1 ? "s" : ""}).`
        );
      }

      setModalDate(null);
      setFile(null);
      setReusedMediaUrl(null);
      setPerAccountFiles({});
      setUsePerAccountFiles(false);
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
                          className="rounded-lg border p-2"
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <MediaThumbnail
                              src={p.media_url}
                              thumbnailUrl={p.thumbnail_url}
                              sizeClass="h-11 w-11"
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

                          <div className="mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/70 pt-1.5">
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(p)}
                              className="rounded px-2 py-0.5 text-[11px] font-medium text-violet-300 hover:bg-violet-950/60"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === p.id}
                              onClick={() => handleDeletePost(p)}
                              className="rounded px-2 py-0.5 text-[11px] font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-40"
                            >
                              {deletingId === p.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collapsible & Day-Grouped Scheduled / Posted History */}
            <section
              className="mt-12 rounded-2xl border p-5"
              style={{
                backgroundColor: "#14141b",
                borderColor: "#2a2a36",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    Scheduled &amp; Posted Content History
                  </h2>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    Grouped per day · {dayGroups.length} day
                    {dayGroups.length === 1 ? "" : "s"} · {posts.length} total
                    item{posts.length === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryOpen((prev) => !prev)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                  style={{
                    backgroundColor: "#1d1d26",
                    borderColor: "#343442",
                    color: "#e4e4e7",
                  }}
                >
                  {historyOpen ? "Collapse card" : "Open history"}
                </button>
              </div>

              {historyOpen && (
                <>
                  <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                            onClick={() => {
                              setHistoryFilter(key);
                              setVisibleDayCount(10);
                            }}
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

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="history-month-select"
                        className="text-xs text-zinc-400"
                      >
                        Month:
                      </label>
                      <select
                        id="history-month-select"
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setVisibleDayCount(10);
                        }}
                        className="rounded-lg border px-2.5 py-1.5 text-xs text-white"
                        style={{
                          backgroundColor: "#0e0e13",
                          borderColor: "#2f2f3d",
                        }}
                      >
                        <option value="all">All months</option>
                        {availableMonths.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {paginatedDayGroups.length === 0 ? (
                    <p
                      className="mt-6 text-sm"
                      style={{ color: "var(--muted)" }}
                    >
                      No posts found for this filter.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {paginatedDayGroups.map((group) => {
                        const isExpanded = Boolean(expandedDayKeys[group.dateKey]);
                        const outsideRolling30 = !calendarDayKeys.has(
                          group.dateKey
                        );

                        return (
                          <div
                            key={group.dateKey}
                            className="rounded-xl border"
                            style={{
                              backgroundColor: "#0e0e13",
                              borderColor: isExpanded ? "#363647" : "#262632",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleDayAccordion(group.dateKey)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="font-mono text-xs text-violet-300">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                  {group.dateKey}
                                </span>
                                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                                  {group.posts.length}{" "}
                                  {group.posts.length === 1 ? "post" : "posts"}
                                </span>
                                {group.postedCount > 0 && (
                                  <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-[11px] text-emerald-300">
                                    {group.postedCount} posted
                                  </span>
                                )}
                                {group.scheduledCount > 0 && (
                                  <span className="rounded bg-violet-950/80 px-2 py-0.5 text-[11px] text-violet-300">
                                    {group.scheduledCount} scheduled
                                  </span>
                                )}
                                {group.failedCount > 0 && (
                                  <span className="rounded bg-red-950/80 px-2 py-0.5 text-[11px] text-red-300">
                                    {group.failedCount} failed
                                  </span>
                                )}
                                {outsideRolling30 && (
                                  <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                                    Outside 30d grid
                                  </span>
                                )}
                              </div>

                              <span className="text-xs text-zinc-400">
                                {isExpanded ? "Hide details" : "Show details"}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="space-y-2.5 border-t border-zinc-800/80 px-4 py-3">
                                {group.posts.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                    style={{
                                      backgroundColor: "#14141c",
                                      borderColor: "#252531",
                                    }}
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      <MediaThumbnail
                                        src={item.media_url}
                                        thumbnailUrl={item.thumbnail_url}
                                        sizeClass="h-12 w-12"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                          {item.caption || "(No caption)"}
                                        </p>
                                        <p className="mt-0.5 text-xs text-zinc-400">
                                          <span className="font-medium text-zinc-200">
                                            {item.account_name || item.platform}
                                          </span>
                                          {item.platform
                                            ? ` (${item.platform})`
                                            : ""}{" "}
                                          · Time:{" "}
                                          <span className="text-zinc-200">
                                            {(item.scheduled_time || "").slice(
                                              0,
                                              5
                                            )}
                                          </span>
                                          {item.timezone
                                            ? ` ${item.timezone}`
                                            : ""}
                                        </p>
                                        {item.published_at && (
                                          <p className="mt-0.5 text-[11px] text-emerald-400">
                                            Published:{" "}
                                            {new Date(
                                              item.published_at
                                            ).toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                                      <StatusBadge status={item.status} />
                                      <button
                                        type="button"
                                        onClick={() => openRescheduleModal(item)}
                                        className="rounded-lg border border-violet-500/30 bg-violet-950/40 px-2.5 py-1 text-xs font-medium text-violet-200 hover:bg-violet-900/50"
                                      >
                                        Reschedule
                                      </button>
                                      <button
                                        type="button"
                                        disabled={deletingId === item.id}
                                        onClick={() => handleDeletePost(item)}
                                        className="rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-40"
                                      >
                                        {deletingId === item.id
                                          ? "Deleting…"
                                          : "Delete"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {dayGroups.length > visibleDayCount && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleDayCount((prev) => prev + 10)
                            }
                            className="rounded-lg border px-4 py-2 text-xs font-medium text-zinc-200 transition hover:border-violet-400"
                            style={{
                              backgroundColor: "#1b1b24",
                              borderColor: "#323242",
                            }}
                          >
                            Show more days ({dayGroups.length - visibleDayCount}{" "}
                            remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
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
            <h2 className="text-xl font-semibold">Schedule post · {modalDate}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Posts once on the selected date &amp; time (no repeated runs).
            </p>

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <label className="mt-5 block text-sm font-medium">
              Default media
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFile(f);
                if (f) setReusedMediaUrl(null);
              }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) {
                  setFile(dropped);
                  setReusedMediaUrl(null);
                }
              }}
              className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3.5 transition hover:border-violet-400"
              style={{
                backgroundColor: "#0d0d12",
                borderColor: file || reusedMediaUrl ? "#7c3aed" : "#383847",
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
                ) : reusedMediaUrl ? (
                  <>
                    <p className="truncate text-sm font-medium text-violet-200">
                      Using existing media from rescheduled post
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      Click to upload a different file
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
                {file || reusedMediaUrl ? "Change" : "Choose file"}
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

            {/* Different file per platform option */}
            {chosenAccounts.length > 0 && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-[#0d0d12] p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-zinc-200">
                  <span>Use different file per selected account/platform</span>
                  <input
                    type="checkbox"
                    checked={usePerAccountFiles}
                    onChange={(e) => setUsePerAccountFiles(e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                </label>

                {usePerAccountFiles && (
                  <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                    {chosenAccounts.map((acc) => {
                      const customFile = perAccountFiles[acc.id] || null;
                      return (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-[#14141c] px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white">
                              {acc.account_name || acc.id}{" "}
                              <span className="uppercase text-violet-300">
                                ({acc.platform})
                              </span>
                            </p>
                            <p className="truncate text-[11px] text-zinc-400">
                              {customFile
                                ? customFile.name
                                : "Using default media"}
                            </p>
                          </div>

                          <input
                            ref={(el) => {
                              accountFileInputRefs.current[acc.id] = el;
                            }}
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const picked = e.target.files?.[0] || null;
                              setPerAccountFiles((prev) => ({
                                ...prev,
                                [acc.id]: picked,
                              }));
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              accountFileInputRefs.current[acc.id]?.click()
                            }
                            className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-violet-400"
                          >
                            {customFile ? "Change" : "Select file"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
                disabled={!canSubmit}
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
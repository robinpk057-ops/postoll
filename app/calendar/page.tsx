"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

type CalendarPost = {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string | null;
  media_url: string;
  caption: string | null;
  status: string;
  account_id: string | null;
};

type IgAccount = {
  id: string;
  account_name: string;
  connected: boolean;
};

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
        className="rounded-lg border px-3 py-2"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
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
        className="rounded-lg border px-3 py-2"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
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
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [time, setTime] = useState("09:00");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

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

      const list = (accJson.accounts || accJson || []) as IgAccount[];
      const ig = (Array.isArray(list) ? list : []).filter(
        (a) => (a as { platform?: string }).platform === "instagram" || true
      );
      // If API returns { accounts: [...] } with platform field:
      const fromApi = accJson.accounts ?? accJson.data ?? [];
      const igAccounts = (Array.isArray(fromApi) ? fromApi : []).filter(
        (a: { platform?: string; connected?: boolean }) =>
          a.platform === "instagram" && a.connected !== false
      );
      setAccounts(igAccounts.length ? igAccounts : ig);
      if (igAccounts[0]?.id) setAccountId(igAccounts[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function postsForDay(dateKey: string) {
    return posts.filter((p) => p.scheduled_date === dateKey);
  }

  async function submitPost() {
    if (!modalDate || !file) return;
    setSaving(true);
    setError("");

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

      const res = await fetch("/api/calendar/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: modalDate,
          scheduled_time: time.length === 5 ? `${time}:00` : time,
          timezone,
          media_url: publicUrl,
          caption,
          account_id: accountId || undefined,
          platform: "instagram",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed");

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
          Next 30 days · one Instagram account per post · 24-hour times (
          {timezone})
        </p>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {accounts.length === 0 && !loading && (
          <div
            className="mt-6 rounded-xl border p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm">No Instagram account connected.</p>
            <Link
              href="/accounts"
              className="mt-2 inline-block text-sm font-medium"
              style={{ color: "#a78bfa" }}
            >
              Connect Instagram →
            </Link>
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </p>
        ) : (
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
                      onClick={() => setModalDate(key)}
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
                        className="flex gap-2 rounded-lg border p-2"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.media_url}
                          alt=""
                          className="h-12 w-12 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {(p.scheduled_time || "").slice(0, 5)}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            {p.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h2 className="text-xl font-semibold">Add post · {modalDate}</h2>

            <label className="mt-5 block text-sm font-medium">Media</label>
            <input
              type="file"
              accept="image/*,video/*"
              className="mt-2 w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <label className="mt-4 block text-sm font-medium">Time (24h)</label>
            <div className="mt-2">
              <TimePicker24 value={time} onChange={setTime} />
            </div>

            <label className="mt-4 block text-sm font-medium">
              Instagram account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
              }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name || a.id}
                </option>
              ))}
            </select>
            <Link
              href="/accounts"
              className="mt-1 inline-block text-xs"
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
                background: "var(--background)",
                borderColor: "var(--border)",
              }}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalDate(null)}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || saving}
                onClick={submitPost}
                className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                }}
              >
                {saving ? "Saving…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
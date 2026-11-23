"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

type Workflow = {
  id: string;
  name: string;
  mode: string;
  description: string | null;
  active: boolean;
  created_at: string;
  thumbnail_url: string | null;
};

type WorkflowContentItem = {
  id: string;
  title: string | null;
  idea: string | null;
  caption: string | null;
  hashtags: string[] | string | null;
  image_url: string | null;
  platform: string | null;
  type: string | null;
  status: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
};

type WorkflowSlotItem = {
  id: string;
  workflow_id: string;
  day_of_week: number;
  slot_number: number;
  post_time: string;
  pending_post_time?: string | null;
  effective_from_date?: string | null;
  enabled: boolean;
};

function isVideoUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(url);
}

function formatContentText(item: WorkflowContentItem): string {
  const mainText = (item.caption || item.title || item.idea || "").trim();
  const tags = Array.isArray(item.hashtags)
    ? item.hashtags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    : [];

  if (!mainText && tags.length === 0) return "No text content";
  return [mainText, tags.join(" ")].filter(Boolean).join(" ");
}

export default function WorkflowsPage() {
  const supabase = createClient();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByWorkflow, setItemsByWorkflow] = useState<
    Record<string, WorkflowContentItem[]>
  >({});
  const [slotsByWorkflow, setSlotsByWorkflow] = useState<
    Record<string, WorkflowSlotItem[]>
  >({});
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);

  const [draftTimes, setDraftTimes] = useState<Record<string, string>>({});
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);
  const [slotNotice, setSlotNotice] = useState<Record<string, string>>({});

  async function loadWorkflows() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please login first.");
        return;
      }

      const { data, error: wfError } = await supabase
        .from("workflows")
        .select("id, name, mode, description, active, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (wfError) throw wfError;

      const list = data || [];
      const unique = Array.from(
        new Map(list.map((w) => [w.id, w])).values()
      );

      const withThumbs: Workflow[] = await Promise.all(
        unique.map(async (w) => {
          const { data: content } = await supabase
            .from("content")
            .select("image_url")
            .eq("workflow_id", w.id)
            .not("image_url", "is", null)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...w,
            thumbnail_url: content?.image_url ?? null,
          };
        })
      );

      setWorkflows(withThumbs);
    } catch (err) {
      console.error("Load workflow error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load workflows."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleWorkflowCard(workflowId: string) {
    if (expandedId === workflowId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(workflowId);
    setLoadingDetailsId(workflowId);

    try {
      const [contentRes, slotsRes, scheduleRes, settingsRes] =
        await Promise.all([
          supabase
            .from("content")
            .select(
              "id, title, idea, caption, hashtags, image_url, platform, type, status, scheduled_at, published_at, created_at"
            )
            .eq("workflow_id", workflowId)
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("workflow_schedule_slots")
            .select(
              "id, workflow_id, day_of_week, slot_number, post_time, pending_post_time, effective_from_date, enabled"
            )
            .eq("workflow_id", workflowId)
            .eq("enabled", true)
            .order("slot_number", { ascending: true })
            .order("day_of_week", { ascending: true }),
          supabase
            .from("workflow_schedule")
            .select("posts_per_day, reels_per_day")
            .eq("workflow_id", workflowId)
            .maybeSingle(),
          supabase
            .from("workflow_settings")
            .select("posts_per_day")
            .eq("workflow_id", workflowId)
            .maybeSingle(),
        ]);

      const items = (contentRes.data || []) as WorkflowContentItem[];
      const rawSlots = (slotsRes.data || []) as WorkflowSlotItem[];

      const configuredPerDay = Number(
        scheduleRes.data?.posts_per_day ||
          scheduleRes.data?.reels_per_day ||
          settingsRes.data?.posts_per_day ||
          0
      );

      // Group slots by slot_number so a workflow with 1, 2, or 3 posts/day
      // shows only that exact number of daily time controls (1, 2, or 3).
      const distinctBySlotNumber = Array.from(
        new Map(rawSlots.map((s) => [s.slot_number, s])).values()
      ).sort((a, b) => a.slot_number - b.slot_number);

      const dailySlots =
        configuredPerDay > 0
          ? distinctBySlotNumber.slice(0, configuredPerDay)
          : distinctBySlotNumber;

      setItemsByWorkflow((prev) => ({ ...prev, [workflowId]: items }));
      setSlotsByWorkflow((prev) => ({ ...prev, [workflowId]: dailySlots }));

      setDraftTimes((prev) => {
        const next = { ...prev };
        for (const s of dailySlots) {
          const activeOrPending = (
            s.pending_post_time ||
            s.post_time ||
            ""
          ).slice(0, 5);
          if (!next[s.id]) next[s.id] = activeOrPending;
        }
        return next;
      });
    } catch (err) {
      console.error("Load workflow details error:", err);
    } finally {
      setLoadingDetailsId(null);
    }
  }

  async function handleSaveNextDayTime(workflowId: string, slotId: string) {
    const newTime = draftTimes[slotId];
    if (!newTime) return;

    setSavingSlotId(slotId);
    setSlotNotice((prev) => ({ ...prev, [slotId]: "" }));

    try {
      const res = await fetch("/api/workflows/reschedule-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, postTime: newTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not update schedule");
      }

      setSlotsByWorkflow((prev) => ({
        ...prev,
        [workflowId]: (prev[workflowId] || []).map((s) =>
          s.id === slotId
            ? {
                ...s,
                pending_post_time:
                  data.slot?.pending_post_time ?? `${newTime}:00`,
                effective_from_date: data.slot?.effective_from_date ?? null,
              }
            : s
        ),
      }));

      setSlotNotice((prev) => ({
        ...prev,
        [slotId]:
          data.message ||
          "New schedule will happen from tomorrow onwards; today's post will still run at the existing time.",
      }));
    } catch (err) {
      setSlotNotice((prev) => ({
        ...prev,
        [slotId]: err instanceof Error ? err.message : "Failed to save time",
      }));
    } finally {
      setSavingSlotId(null);
    }
  }

  async function deleteWorkflow(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadWorkflows();
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Workflows</h1>
            <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
              Create automated content systems for your brands. Click a card to
              inspect posts or schedule from tomorrow onwards.
            </p>
          </div>

          <Link
            href="/workflows/create"
            className="rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
            }}
          >
            + Create Workflow
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              />
            ))}
          </div>
        )}

        {!loading && workflows.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => {
              const isExpanded = expandedId === workflow.id;
              const items = itemsByWorkflow[workflow.id] || [];
              const slots = slotsByWorkflow[workflow.id] || [];

              return (
                <div
                  key={workflow.id}
                  onClick={() => toggleWorkflowCard(workflow.id)}
                  className={`cursor-pointer rounded-2xl border p-6 transition hover:-translate-y-0.5 ${
                    isExpanded ? "md:col-span-2 lg:col-span-3" : ""
                  }`}
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex gap-4">
                    <div
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {workflow.thumbnail_url &&
                      !isVideoUrl(workflow.thumbnail_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={workflow.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] opacity-50">
                          {workflow.thumbnail_url ? "Media" : "No image"}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate text-xl font-semibold">
                          {workflow.name}
                        </h2>
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-xs"
                          style={{
                            background: workflow.active
                              ? "rgba(34,197,94,.15)"
                              : "rgba(156,163,175,.15)",
                            color: workflow.active ? "#22c55e" : "#9ca3af",
                          }}
                        >
                          {workflow.active ? "Active" : "Paused"}
                        </span>
                      </div>

                      <p
                        className="mt-2 line-clamp-2 text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        {workflow.description ||
                          "AI generated content workflow"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span>
                      Mode:
                      <span className="ml-2 font-medium">{workflow.mode}</span>
                    </span>

                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => toggleWorkflowCard(workflow.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:opacity-80"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {isExpanded ? "Hide details" : "View posts & time"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(workflow.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="mt-6 space-y-6 border-t pt-6"
                      style={{ borderColor: "var(--border)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Schedule Time Controls (From Tomorrow Onwards) */}
                      <div>
                        <h3 className="text-sm font-semibold">
                          Schedule Time ({slots.length}{" "}
                          {slots.length === 1 ? "time" : "times"} per day ·
                          Effective From Tomorrow Onwards)
                        </h3>
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          New schedule will happen from tomorrow onwards;
                          today&apos;s post will still run at the existing time.
                        </p>

                        {loadingDetailsId === workflow.id ? (
                          <div className="mt-3 text-xs opacity-70">
                            Loading schedule slots and content…
                          </div>
                        ) : slots.length === 0 ? (
                          <p
                            className="mt-3 text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            No active schedule slots found for this workflow.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {slots.map((slot, idx) => {
                              const currentTime = String(slot.post_time).slice(
                                0,
                                5
                              );
                              const pendingTime = slot.pending_post_time
                                ? String(slot.pending_post_time).slice(0, 5)
                                : null;

                              return (
                                <div
                                  key={slot.id}
                                  className="rounded-xl border p-3.5 text-xs"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  <div className="flex items-center justify-between font-medium">
                                    <span>Time #{idx + 1}</span>
                                    <span style={{ color: "var(--muted)" }}>
                                      Today: {currentTime}
                                    </span>
                                  </div>

                                  {pendingTime && slot.effective_from_date && (
                                    <div className="mt-1.5 text-[11px] text-amber-400">
                                      From {slot.effective_from_date}:{" "}
                                      {pendingTime}
                                    </div>
                                  )}

                                  <div className="mt-3 flex items-center gap-2">
                                    <input
                                      type="time"
                                      value={draftTimes[slot.id] ?? currentTime}
                                      onChange={(e) =>
                                        setDraftTimes((prev) => ({
                                          ...prev,
                                          [slot.id]: e.target.value,
                                        }))
                                      }
                                      className="rounded-lg border bg-transparent px-2.5 py-1.5 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    />
                                    <button
                                      type="button"
                                      disabled={savingSlotId === slot.id}
                                      onClick={() =>
                                        handleSaveNextDayTime(
                                          workflow.id,
                                          slot.id
                                        )
                                      }
                                      className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                      style={{
                                        background: "var(--foreground)",
                                        color: "var(--background)",
                                      }}
                                    >
                                      {savingSlotId === slot.id
                                        ? "Saving…"
                                        : "Save for tomorrow"}
                                    </button>
                                  </div>

                                  {slotNotice[slot.id] && (
                                    <p className="mt-2 text-[11px] text-emerald-400">
                                      {slotNotice[slot.id]}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Individual Content Boxes */}
                      <div>
                        <h3 className="text-sm font-semibold">
                          Workflow Content History ({items.length})
                        </h3>

                        {items.length === 0 ? (
                          <p
                            className="mt-2 text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            No content items for this workflow yet.
                          </p>
                        ) : (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((item) => {
                              const displayDateObj = new Date(
                                item.published_at ||
                                  item.scheduled_at ||
                                  item.created_at
                              );
                              const dateStr = displayDateObj.toLocaleDateString();
                              const timeStr = displayDateObj.toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              );
                              const slotPeriod =
                                slots[0]?.post_time
                                  ? String(slots[0].post_time).slice(0, 5)
                                  : "Scheduled slot";
                              const textBody = formatContentText(item);

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-xl border p-3.5 text-xs"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium capitalize">
                                      {item.status || "queued"}
                                    </span>
                                    <span
                                      className="text-[11px] capitalize"
                                      style={{ color: "var(--muted)" }}
                                    >
                                      {item.platform || "workflow"}
                                    </span>
                                  </div>

                                  <div
                                    className="mt-2 space-y-0.5 text-[11px]"
                                    style={{ color: "var(--muted)" }}
                                  >
                                    <div>
                                      {item.published_at
                                        ? "Posted"
                                        : "Date/Time"}
                                      : {dateStr} · {timeStr}
                                    </div>
                                    <div>Time period: {slotPeriod}</div>
                                  </div>

                                  <div
                                    className="mt-2.5 rounded-lg border p-2.5"
                                    style={{ borderColor: "var(--border)" }}
                                  >
                                    {item.image_url &&
                                      (isVideoUrl(item.image_url) ? (
                                        <video
                                          src={item.image_url}
                                          controls
                                          preload="metadata"
                                          className="mb-2 h-24 w-full rounded object-cover"
                                        />
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={item.image_url}
                                          alt=""
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                          className="mb-2 h-24 w-full rounded object-cover"
                                        />
                                      ))}
                                    <p className="whitespace-pre-line font-medium">
                                      {textBody}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h3 className="text-lg font-semibold">Delete workflow?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              This removes the workflow, schedule, and related content. This
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmId}
                onClick={() => {
                  if (confirmId) {
                    deleteWorkflow(confirmId);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deletingId === confirmId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
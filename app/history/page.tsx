"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";

type WorkflowRow = {
  id: string;
  name: string;
  mode: string;
  active: boolean;
};

type ContentRow = {
  id: string;
  workflow_id: string | null;
  title: string | null;
  idea: string | null;
  caption: string | null;
  image_url: string | null;
  platform: string | null;
  status: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
};

type WorkflowAccountRow = {
  workflow_id: string;
  platform: string;
  account_id: string;
};

type SlotRow = {
  workflow_id: string;
  day_of_week: number;
  post_time: string;
  enabled: boolean;
};

type ConnectedAccount = {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  connected: boolean;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatPlatform(platform: string): string {
  const p = (platform || "").toLowerCase();
  if (p === "youtube") return "YouTube";
  if (p === "instagram") return "Instagram";
  if (p === "facebook") return "Facebook";
  if (p === "linkedin") return "LinkedIn";
  if (p === "tiktok") return "TikTok";
  if (p === "x") return "X";
  return platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "Platform";
}

function isVideoUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(url);
}

export default function PublishHistoryPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"user_uploaded" | "ai_generated">(
    "user_uploaded"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [workflowAccounts, setWorkflowAccounts] = useState<WorkflowAccountRow[]>(
    []
  );
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<
    ConnectedAccount[]
  >([]);

  async function loadHistory() {
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

      const [wfRes, accountsApiRes] = await Promise.all([
        supabase
          .from("workflows")
          .select("id, name, mode, active")
          .eq("user_id", user.id),
        fetch("/api/accounts", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : { accounts: [] }
        ),
      ]);

      if (wfRes.error) throw wfRes.error;

      const wfList = (wfRes.data || []) as WorkflowRow[];
      setWorkflows(wfList);
      setConnectedAccounts((accountsApiRes.accounts || []) as ConnectedAccount[]);

      const wfIds = wfList.map((w) => w.id);
      if (wfIds.length === 0) {
        setContents([]);
        setWorkflowAccounts([]);
        setSlots([]);
        return;
      }

      const [contentRes, waRes, slotRes] = await Promise.all([
        supabase
          .from("content")
          .select(
            "id, workflow_id, title, idea, caption, image_url, platform, status, scheduled_at, published_at, created_at"
          )
          .in("workflow_id", wfIds)
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("workflow_accounts")
          .select("workflow_id, platform, account_id")
          .in("workflow_id", wfIds),
        supabase
          .from("workflow_schedule_slots")
          .select("workflow_id, day_of_week, post_time, enabled")
          .in("workflow_id", wfIds)
          .eq("enabled", true),
      ]);

      if (contentRes.error) throw contentRes.error;

      setContents((contentRes.data || []) as ContentRow[]);
      setWorkflowAccounts((waRes.data || []) as WorkflowAccountRow[]);
      setSlots((slotRes.data || []) as SlotRow[]);
    } catch (err) {
      console.error("History load error:", err);
      setError(
        err instanceof Error ? err.message : "Unable to load publish history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workflowMap = useMemo(
    () => new Map(workflows.map((w) => [w.id, w])),
    [workflows]
  );

  const accountNameMap = useMemo(() => {
    const map = new Map<string, ConnectedAccount>();
    for (const acc of connectedAccounts) {
      map.set(`${acc.platform.toLowerCase()}:${acc.account_id}`, acc);
    }
    return map;
  }, [connectedAccounts]);

  const enrichedItems = useMemo(() => {
    return contents.map((item) => {
      const wf = item.workflow_id ? workflowMap.get(item.workflow_id) : undefined;
      const isUserUploaded =
        (wf?.mode || "").toLowerCase() === "user_uploaded";

      const wfSlots = item.workflow_id
        ? slots.filter((s) => s.workflow_id === item.workflow_id)
        : [];

      const uniqueDays = Array.from(
        new Set(wfSlots.map((s) => DAY_NAMES[s.day_of_week] || ""))
      ).filter(Boolean);

      const uniqueTimes = Array.from(
        new Set(wfSlots.map((s) => String(s.post_time || "").slice(0, 5)))
      ).filter(Boolean);

      const linkedAccounts = item.workflow_id
        ? workflowAccounts.filter((wa) => wa.workflow_id === item.workflow_id)
        : [];

      const accountStatuses = linkedAccounts.map((wa) => {
        const key = `${wa.platform.toLowerCase()}:${wa.account_id}`;
        const matched = accountNameMap.get(key);
        const rawStatus = (item.status || "queued").toLowerCase();

        let statusLabel = "Scheduled";
        let statusTone = "amber";

        if (rawStatus === "published") {
          statusLabel = "Published";
          statusTone = "emerald";
        } else if (rawStatus === "failed" || rawStatus === "error") {
          statusLabel = "Failed";
          statusTone = "rose";
        }

        return {
          key,
          platform: formatPlatform(wa.platform),
          accountName:
            matched?.account_name || `${formatPlatform(wa.platform)} Account`,
          connected: matched ? matched.connected : true,
          statusLabel,
          statusTone,
        };
      });

      const refDate = new Date(
        item.published_at || item.scheduled_at || item.created_at
      );

      return {
        ...item,
        workflowName: wf?.name || "Untitled Workflow",
        category: isUserUploaded
          ? ("user_uploaded" as const)
          : ("ai_generated" as const),
        scheduledDaysLabel:
          uniqueDays.length > 0
            ? uniqueDays.join(", ")
            : refDate.toLocaleDateString(undefined, { weekday: "long" }),
        scheduledTimesLabel:
          uniqueTimes.length > 0
            ? uniqueTimes.join(", ")
            : refDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
        timestampLabel: `${refDate.toLocaleDateString()} · ${refDate.toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`,
        displayTitle:
          (item.title || item.caption || item.idea || "Scheduled Media").trim(),
        accountStatuses,
      };
    });
  }, [contents, workflowMap, slots, workflowAccounts, accountNameMap]);

  const userUploadedItems = useMemo(
    () => enrichedItems.filter((i) => i.category === "user_uploaded"),
    [enrichedItems]
  );

  const aiGeneratedItems = useMemo(
    () => enrichedItems.filter((i) => i.category === "ai_generated"),
    [enrichedItems]
  );

  const visibleItems =
    activeTab === "user_uploaded" ? userUploadedItems : aiGeneratedItems;

  return (
    <AppShell>
      <div className="w-full px-4 py-6 sm:px-6 md:px-8">
        {/* HEADER CARD */}
        <div
          className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Publish History
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--muted)" }}
            >
              View posted content, scheduled days, times, and connected account
              status across your workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="self-start rounded-xl border px-4 py-2 text-xs font-semibold transition hover:bg-white/5 disabled:opacity-50 sm:self-auto"
            style={{ borderColor: "var(--border)" }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* TABS */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("user_uploaded")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "user_uploaded"
                ? "bg-[#7C5CFF] text-white"
                : "border hover:bg-white/5"
            }`}
            style={
              activeTab === "user_uploaded"
                ? undefined
                : {
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }
            }
          >
            <span>User Added &amp; Posted</span>
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold">
              {userUploadedItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai_generated")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "ai_generated"
                ? "bg-[#7C5CFF] text-white"
                : "border hover:bg-white/5"
            }`}
            style={
              activeTab === "ai_generated"
                ? undefined
                : {
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }
            }
          >
            <span>AI Created &amp; Posted</span>
            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold">
              {aiGeneratedItems.length}
            </span>
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
            {error}
          </div>
        )}

        {/* CONTENT LIST */}
        {loading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="mt-5 rounded-2xl border p-8 text-center"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <p className="text-sm font-semibold">
              {activeTab === "user_uploaded"
                ? "No user-uploaded content history yet."
                : "No AI-created content history yet."}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--muted)" }}
            >
              Scheduled and posted items will appear here with their connected
              accounts, days, times, and status.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => {
              const isPublished =
                (item.status || "").toLowerCase() === "published";

              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border p-4"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div>
                    {/* TOP ROW: WORKFLOW & STATUS */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate text-xs font-semibold"
                        style={{ color: "var(--muted)" }}
                      >
                        {item.workflowName}
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isPublished
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {isPublished ? "Published" : item.status || "Queued"}
                      </span>
                    </div>

                    {/* TITLE */}
                    <h2 className="mt-2 line-clamp-1 text-sm font-bold">
                      {item.displayTitle}
                    </h2>

                    {/* DAY, TIME & TIMESTAMP */}
                    <div
                      className="mt-3 rounded-xl border p-3 text-xs"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ color: "var(--muted)" }}>Day</span>
                        <span className="font-semibold">
                          {item.scheduledDaysLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span style={{ color: "var(--muted)" }}>Time</span>
                        <span className="font-semibold">
                          {item.scheduledTimesLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span style={{ color: "var(--muted)" }}>
                          {isPublished ? "Posted" : "Scheduled"}
                        </span>
                        <span className="font-semibold">
                          {item.timestampLabel}
                        </span>
                      </div>
                    </div>

                    {/* MEDIA PREVIEW */}
                    {item.image_url && (
                      <div
                        className="mt-3 overflow-hidden rounded-xl border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {isVideoUrl(item.image_url) ? (
                          <video
                            src={item.image_url}
                            controls
                            preload="metadata"
                            className="h-32 w-full bg-black object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={item.displayTitle}
                            className="h-32 w-full object-cover"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* CONNECTED ACCOUNTS & STATUS */}
                  <div
                    className="mt-3.5 border-t pt-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{ color: "var(--muted)" }}
                    >
                      Connected Accounts
                    </p>

                    {item.accountStatuses.length === 0 ? (
                      <p
                        className="mt-1.5 text-xs"
                        style={{ color: "var(--muted)" }}
                      >
                        No target account linked.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {item.accountStatuses.map((acc) => (
                          <div
                            key={acc.key}
                            className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold">
                                {acc.accountName}
                              </span>
                              <span
                                className="ml-1.5 text-[11px]"
                                style={{ color: "var(--muted)" }}
                              >
                                ({acc.platform})
                                {!acc.connected && " · Reconnect"}
                              </span>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                acc.statusTone === "emerald"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : acc.statusTone === "rose"
                                    ? "bg-rose-500/15 text-rose-300"
                                    : "bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {acc.statusLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

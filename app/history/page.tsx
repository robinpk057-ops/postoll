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
        category: isUserUploaded ? ("user_uploaded" as const) : ("ai_generated" as const),
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
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:px-10">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#C4B5FD]">
              Publishing &amp; Delivery Log
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Publish History
            </h1>
            <p className="mt-2 text-sm font-medium text-zinc-400">
              Track posted content, scheduled days, posting times, and live
              delivery status for every connected account.
            </p>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="self-start rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition hover:bg-white/[0.1] disabled:opacity-50 sm:self-auto"
          >
            {loading ? "Refreshing..." : "⟳ Refresh Live Data"}
          </button>
        </div>

        {/* TABS */}
        <div className="mt-8 flex flex-wrap gap-3 border-b border-white/10 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("user_uploaded")}
            className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-extrabold tracking-tight transition ${
              activeTab === "user_uploaded"
                ? "bg-gradient-to-r from-[#7C5CFF] to-[#EC4899] text-white shadow-lg shadow-[#7C5CFF]/25"
                : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <span>User Added &amp; Posted</span>
            <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-black">
              {userUploadedItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai_generated")}
            className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-extrabold tracking-tight transition ${
              activeTab === "ai_generated"
                ? "bg-gradient-to-r from-[#7C5CFF] to-[#EC4899] text-white shadow-lg shadow-[#7C5CFF]/25"
                : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <span>AI Created &amp; Posted</span>
            <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-black">
              {aiGeneratedItems.length}
            </span>
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {error}
          </div>
        )}

        {/* CONTENT LIST */}
        {loading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
              />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-lg font-extrabold text-white">
              {activeTab === "user_uploaded"
                ? "No User-Uploaded Content History Yet"
                : "No AI-Created Content History Yet"}
            </p>
            <p className="mt-1.5 text-sm font-medium text-zinc-400">
              Once a workflow runs or schedules content, its connected accounts,
              days, times, and status appear here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => {
              const isPublished =
                (item.status || "").toLowerCase() === "published";

              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#111118] p-5 shadow-xl transition hover:border-[#7C5CFF]/50"
                >
                  <div>
                    {/* MEDIA PREVIEW */}
                    {item.image_url && (
                      <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
                        {isVideoUrl(item.image_url) ? (
                          <video
                            src={item.image_url}
                            controls
                            preload="metadata"
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={item.displayTitle}
                            className="h-40 w-full object-cover"
                          />
                        )}
                      </div>
                    )}

                    {/* WORKFLOW & OVERALL STATUS */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-extrabold uppercase tracking-wider text-[#C4B5FD]">
                        {item.workflowName}
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                          isPublished
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {isPublished ? "Published" : item.status || "Queued"}
                      </span>
                    </div>

                    {/* CONTENT TITLE */}
                    <h2 className="mt-2.5 line-clamp-2 text-base font-extrabold leading-snug text-white">
                      {item.displayTitle}
                    </h2>

                    {/* DAY & TIME DETAILS */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Scheduled Day
                        </p>
                        <p className="mt-0.5 text-xs font-extrabold text-white">
                          {item.scheduledDaysLabel}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Slot Time
                        </p>
                        <p className="mt-0.5 text-xs font-extrabold text-white">
                          {item.scheduledTimesLabel}
                        </p>
                      </div>

                      <div className="col-span-2 border-t border-white/10 pt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {isPublished ? "Posted On" : "Scheduled Timestamp"}
                        </p>
                        <p className="mt-0.5 text-xs font-extrabold text-zinc-200">
                          {item.timestampLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CONNECTED ACCOUNTS & PER-ACCOUNT STATUS */}
                  <div className="mt-4 border-t border-white/10 pt-3.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                      Connected Accounts
                    </p>

                    {item.accountStatuses.length === 0 ? (
                      <p className="mt-1.5 text-xs font-semibold text-zinc-500">
                        No target account linked
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {item.accountStatuses.map((acc) => (
                          <div
                            key={acc.key}
                            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-white">
                                {acc.accountName}
                              </p>
                              <p className="text-[11px] font-bold text-zinc-400">
                                {acc.platform}
                                {!acc.connected && " · Reconnect Needed"}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                                acc.statusTone === "emerald"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : acc.statusTone === "rose"
                                    ? "bg-rose-500/20 text-rose-300"
                                    : "bg-amber-500/20 text-amber-300"
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

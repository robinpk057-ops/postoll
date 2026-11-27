"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import { getPlanConfig, PlanTier } from "@/lib/plans";

type MetricRow = {
  id: string;
  workflow_id: string | null;
  content_id: string;
  platform: string;
  metric_date: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
};

type WorkflowMeta = {
  id: string;
  name: string;
};

type ContentTitleMap = Record<string, string>;

export default function AnalyticsPage() {
  const supabase = createClient();

  const [planTier, setPlanTier] = useState<string>("scheduler");
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("all");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [titles, setTitles] = useState<ContentTitleMap>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to view analytics.");
        return;
      }

      const [profRes, wfRes, metricsRes, contentRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("workflows")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("post_metrics_daily")
          .select(
            "id, workflow_id, content_id, platform, metric_date, views, reach, likes, comments, shares"
          )
          .eq("user_id", user.id)
          .order("metric_date", { ascending: false })
          .limit(200),
        supabase
          .from("content")
          .select("id, title, caption")
          .eq("user_id", user.id)
          .eq("status", "published")
          .limit(200),
      ]);

      if (profRes.data?.plan_tier) {
        setPlanTier(profRes.data.plan_tier);
      }

      setWorkflows((wfRes.data || []) as WorkflowMeta[]);
      setMetrics((metricsRes.data || []) as MetricRow[]);

      const map: ContentTitleMap = {};
      for (const c of contentRes.data || []) {
        map[c.id] = (c.title || c.caption || "Published Post").slice(0, 80);
      }
      setTitles(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncNow() {
    try {
      setSyncing(true);
      setNotice("");
      setError("");

      const res = await fetch("/api/analytics/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed.");
      }

      setNotice(`Synced ${data.syncedRows ?? 0} published post metrics.`);
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = getPlanConfig(planTier as PlanTier);
  const isGrowth = plan.id === "growth";

  const filteredMetrics = useMemo(() => {
    if (selectedWorkflowId === "all") return metrics;
    return metrics.filter((m) => m.workflow_id === selectedWorkflowId);
  }, [metrics, selectedWorkflowId]);

  const totals = useMemo(() => {
    return filteredMetrics.reduce(
      (acc, row) => {
        acc.views += Number(row.views || 0);
        acc.reach += Number(row.reach || 0);
        acc.likes += Number(row.likes || 0);
        acc.comments += Number(row.comments || 0);
        acc.shares += Number(row.shares || 0);
        return acc;
      },
      { views: 0, reach: 0, likes: 0, comments: 0, shares: 0 }
    );
  }, [filteredMetrics]);

  return (
    <AppShell>
      <div className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div
          className="mb-8 flex flex-col justify-between gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center sm:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.16) 0%, var(--card) 55%, rgba(124,92,255,0.16) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
              ◈ Growth Tier Insights
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Analytics
            </h1>
            <p
              className="mt-2 max-w-2xl text-sm"
              style={{ color: "var(--muted)" }}
            >
              Daily views, reach, likes, comments, and shares across your
              published workflow content.
            </p>
          </div>

          {isGrowth ? (
            <div className="flex flex-wrap items-center gap-3">
              {workflows.length > 0 && (
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="rounded-xl border bg-black/30 px-3.5 py-2.5 text-xs font-bold text-white"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="all" className="bg-neutral-900">
                    All Workflows
                  </option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id} className="bg-neutral-900">
                      {wf.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                disabled={syncing}
                onClick={handleSyncNow}
                className="rounded-2xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
              >
                {syncing ? "Syncing Metrics…" : "Sync Metrics Now"}
              </button>
            </div>
          ) : (
            <Link
              href="/settings"
              className="shrink-0 rounded-2xl bg-[#7C5CFF] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#6A48F5]"
            >
              Upgrade to Growth ($39/mo)
            </Link>
          )}
        </div>

        {notice && (
          <div className="mb-6 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {!loading && !isGrowth ? (
          <div
            className="rounded-3xl border p-8 text-center"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-xl font-bold">
              Cross-Platform Analytics is a Growth Plan Feature
            </h2>
            <p
              className="mx-auto mt-2 max-w-lg text-sm"
              style={{ color: "var(--muted)" }}
            >
              You are currently on the <strong>{plan.name}</strong> plan.
              Upgrade to <strong>Growth</strong> to unlock automated daily
              metrics ingestion across YouTube, Instagram, Facebook, TikTok, and
              LinkedIn.
            </p>
            <Link
              href="/settings"
              className="mt-5 inline-block rounded-2xl bg-[#7C5CFF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5]"
            >
              View Plans &amp; Upgrade
            </Link>
          </div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["Total Views", totals.views],
                  ["Total Reach", totals.reach],
                  ["Likes", totals.likes],
                  ["Comments", totals.comments],
                  ["Shares", totals.shares],
                ] as const
              ).map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-2xl border p-5"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {loading ? "—" : val.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* DAILY METRICS TABLE */}
            <div
              className="mt-8 overflow-hidden rounded-2xl border"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="border-b px-6 py-4"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="text-base font-bold">
                  Daily Post Performance ({filteredMetrics.length})
                </h2>
              </div>

              {filteredMetrics.length === 0 ? (
                <p
                  className="p-6 text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  No metrics recorded yet. Publish posts from a workflow and
                  click &ldquo;Sync Metrics Now&rdquo;.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className="border-b uppercase"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--muted)",
                      }}
                    >
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Post</th>
                        <th className="px-6 py-3">Platform</th>
                        <th className="px-6 py-3">Views</th>
                        <th className="px-6 py-3">Likes</th>
                        <th className="px-6 py-3">Comments</th>
                        <th className="px-6 py-3">Shares</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMetrics.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b last:border-b-0"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <td className="px-6 py-3.5 font-medium">
                            {row.metric_date}
                          </td>
                          <td className="px-6 py-3.5">
                            {titles[row.content_id] || row.content_id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-3.5 capitalize">
                            {row.platform}
                          </td>
                          <td className="px-6 py-3.5 font-bold">
                            {Number(row.views || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            {Number(row.likes || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            {Number(row.comments || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            {Number(row.shares || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

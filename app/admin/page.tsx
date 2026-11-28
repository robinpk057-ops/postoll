"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BANNER_CONTENT,
  DEFAULT_HERO_CONTENT,
  DEFAULT_STATS_CONTENT,
  type BannerCmsContent,
  type HeroCmsContent,
  type StatCmsItem,
} from "@/lib/cms-defaults";

type AdminTab = "cms" | "users" | "monitoring" | "security" | "watchdog";

type WatchdogIncidentRow = {
  id: string;
  fingerprint: string;
  source: string;
  severity: "info" | "warning" | "critical" | string;
  category: string;
  title: string;
  summary: string;
  recommended_action: string | null;
  affected_route_or_feature: string | null;
  affected_user_id: string | null;
  occurrence_count: number;
  status: "open" | "acknowledged" | "resolved" | string;
  email_sent_at: string | null;
  created_at: string;
  last_seen_at: string;
};

type SectionRow = {
  section_key: string;
  page_slug: string;
  label: string;
  content: Record<string, unknown>;
  updated_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  credits: number | null;
  is_admin: boolean | null;
  created_at: string | null;
};

type ApiLogRow = {
  id: string;
  user_id: string | null;
  provider: string;
  endpoint: string;
  status: string;
  credits_charged: number;
  estimated_cost_usd: number | string;
  error_message: string | null;
  created_at: string;
};

type WebhookRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  status: string;
  processed_at: string;
};

type AuditRow = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_subscription_id: string | null;
  plan_tier: string;
  billing_cycle: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  paused_at: string | null;
  last_payment_at: string | null;
};

type AdminBillingTxRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_event_id: string;
  event_kind: string;
  plan_tier: string;
  billing_cycle: string;
  amount_cents: number;
  currency: string;
  status: string;
  invoice_number: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  customer_email: string | null;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  occurred_at: string;
};

type OverviewResponse = {
  summary: {
    totalUsers: number;
    totalApiCalls: number;
    errorCount: number;
    totalApiCostUsd: number;
    totalCreditsCharged: number;
    webhookEventsCount: number;
    activeSubscriptionsCount?: number;
    totalRevenueUsd?: number;
  };
  users: UserRow[];
  apiLogs: ApiLogRow[];
  webhooks: WebhookRow[];
  auditLogs: AuditRow[];
  subscriptions?: AdminSubscriptionRow[];
  billingTransactions?: AdminBillingTxRow[];
  warnings?: {
    missingServiceRoleKey?: boolean;
  };
};

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("cms");
  const [loading, setLoading] = useState(true);
  const [refreshingOverview, setRefreshingOverview] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [hero, setHero] = useState<HeroCmsContent>(DEFAULT_HERO_CONTENT);
  const [stats, setStats] = useState<StatCmsItem[]>(DEFAULT_STATS_CONTENT);
  const [banner, setBanner] = useState<BannerCmsContent>(DEFAULT_BANNER_CONTENT);

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [watchdogIncidents, setWatchdogIncidents] = useState<WatchdogIncidentRow[]>([]);
  const [watchdogSummary, setWatchdogSummary] = useState({
    open: 0,
    acknowledged: 0,
    resolved: 0,
    criticalOpen: 0,
  });
  const [watchdogFilter, setWatchdogFilter] = useState<"all" | "open" | "acknowledged" | "resolved">("open");
  const [loadingWatchdog, setLoadingWatchdog] = useState(false);
  const [updatingIncidentId, setUpdatingIncidentId] = useState<string | null>(null);

  const loadWatchdog = useCallback(async () => {
    setLoadingWatchdog(true);
    try {
      const res = await fetch("/api/admin/watchdog", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.incidents)) {
        setWatchdogIncidents(data.incidents);
      }
      if (data.summary) {
        setWatchdogSummary(data.summary);
      }
    } catch {
      // Non-blocking watchdog fetch
    } finally {
      setLoadingWatchdog(false);
    }
  }, []);

  useEffect(() => {
    loadWatchdog();
  }, [loadWatchdog]);

  const handleUpdateIncidentStatus = useCallback(
    async (id: string, nextStatus: "open" | "acknowledged" | "resolved") => {
      setUpdatingIncidentId(id);
      try {
        const res = await fetch("/api/admin/watchdog", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: nextStatus }),
        });
        if (res.ok) {
          await loadWatchdog();
          setStatusMessage({
            type: "success",
            text: `Incident marked as ${nextStatus}.`,
          });
        } else {
          setStatusMessage({
            type: "error",
            text: "Could not update incident status.",
          });
        }
      } catch {
        setStatusMessage({
          type: "error",
          text: "Network error updating incident.",
        });
      } finally {
        setUpdatingIncidentId(null);
      }
    },
    [loadWatchdog]
  );

  const loadOverview = useCallback(async (isManual = false) => {
    if (isManual) setRefreshingOverview(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OverviewResponse;
      setOverview(data);
    } catch {
      // Non-blocking overview fetch
    } finally {
      if (isManual) setRefreshingOverview(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cmsRes] = await Promise.all([
          fetch("/api/admin/cms", { cache: "no-store" }),
          loadOverview(false),
        ]);

        if (!cmsRes.ok) {
          throw new Error("Could not load CMS sections");
        }
        const data = (await cmsRes.json()) as { sections?: SectionRow[] };
        if (!active || !Array.isArray(data.sections)) return;

        for (const row of data.sections) {
          if (row.section_key === "home.hero") {
            setHero({
              ...DEFAULT_HERO_CONTENT,
              ...(row.content as Partial<HeroCmsContent>),
            });
          } else if (row.section_key === "home.stats") {
            if (Array.isArray(row.content.items)) {
              setStats(row.content.items as StatCmsItem[]);
            }
          } else if (row.section_key === "app.banner") {
            setBanner({
              ...DEFAULT_BANNER_CONTENT,
              ...(row.content as Partial<BannerCmsContent>),
            });
          }
        }
      } catch (err) {
        if (active) {
          setStatusMessage({
            type: "error",
            text:
              err instanceof Error
                ? err.message
                : "Failed to load admin configuration",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadOverview]);

  async function saveSection(sectionKey: string, content: unknown) {
    setSavingKey(sectionKey);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section_key: sectionKey, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save changes");
      }
      setStatusMessage({
        type: "success",
        text: `Saved "${sectionKey}" and refreshed live pages.`,
      });
      await loadOverview(false);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleFileUpload(
    file: File | undefined,
    field: "heroVideoUrl" | "heroPosterUrl"
  ) {
    if (!file) return;
    setUploadingField(field);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }

      setHero((prev) => ({ ...prev, [field]: data.url as string }));
      setStatusMessage({
        type: "success",
        text: `Uploaded asset to public-assets storage. Click "Save Hero Section" to publish.`,
      });
      await loadOverview(false);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploadingField(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const list = overview?.users ?? [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }, [overview?.users, userSearch]);

  const filteredLogs = useMemo(() => {
    const list = overview?.apiLogs ?? [];
    if (!onlyErrors) return list;
    return list.filter((row) => String(row.status).toLowerCase() === "error");
  }, [overview?.apiLogs, onlyErrors]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0D0D10] p-12 text-center text-sm text-neutral-400">
        Loading Admin Control Center...
      </div>
    );
  }

  const summary = overview?.summary ?? {
    totalUsers: 0,
    totalApiCalls: 0,
    errorCount: 0,
    totalApiCostUsd: 0,
    totalCreditsCharged: 0,
    webhookEventsCount: 0,
  };

  return (
    <div className="space-y-8">
      {/* Header & Refresh */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#7C5CFF]">
            CMS, Users, Costs &amp; Security Control
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Postoll Admin Control Center
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Manage content &amp; media, inspect accounts, monitor API costs &amp; errors, and review security logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => { loadOverview(true); loadWatchdog(); }}
          disabled={refreshingOverview}
          className="self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-200 transition hover:border-white/35 hover:text-white disabled:opacity-50 sm:self-auto"
        >
          {refreshingOverview ? "Refreshing..." : "↻ Refresh Telemetry"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#0D0D10] p-5">
          <p className="text-xs text-neutral-400">Registered Users</p>
          <p className="mt-2 text-2xl font-black">{summary.totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D0D10] p-5">
          <p className="text-xs text-neutral-400">Est. API Spend (USD)</p>
          <p className="mt-2 text-2xl font-black text-[#10B981]">
            ${summary.totalApiCostUsd.toFixed(4)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D0D10] p-5">
          <p className="text-xs text-neutral-400">API / Workflow Errors</p>
          <p className="mt-2 text-2xl font-black text-rose-400">
            {summary.errorCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0D0D10] p-5">
          <p className="text-xs text-neutral-400">Credits Charged / Webhooks</p>
          <p className="mt-2 text-2xl font-black text-[#C4B5FD]">
            {summary.totalCreditsCharged}{" "}
            <span className="text-xs font-normal text-neutral-400">
              ({summary.webhookEventsCount} events)
            </span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {(
          [
            ["cms", "CMS & Media Editor"],
            ["users", `Users & Credits (${summary.totalUsers})`],
            ["monitoring", `API Costs & Issues (${summary.totalApiCalls})`],
            ["security", "Payments & Audit Trail"],
            ["watchdog", `Chaar & Watchdog (${watchdogSummary.open} Open)`],
          ] as const
        ).map(([tabKey, label]) => {
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                isActive
                  ? "bg-[#7C5CFF] text-white"
                  : "border border-white/10 bg-[#0D0D10] text-neutral-300 hover:border-white/30 hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {statusMessage && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* TAB 1: CMS & MEDIA EDITOR */}
      {activeTab === "cms" && (
        <div className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Home Hero &amp; Media</h2>
                <p className="text-xs text-neutral-400">
                  Section key: <code className="text-neutral-200">home.hero</code>
                </p>
              </div>
              <button
                type="button"
                disabled={savingKey === "home.hero"}
                onClick={() => saveSection("home.hero", hero)}
                className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50 sm:text-sm"
              >
                {savingKey === "home.hero" ? "Saving..." : "Save Hero Section"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Top Badge
                </label>
                <input
                  type="text"
                  value={hero.badge}
                  onChange={(e) => setHero({ ...hero, badge: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Main Headline (H1)
                </label>
                <input
                  type="text"
                  value={hero.headline}
                  onChange={(e) => setHero({ ...hero, headline: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300">
                Subheadline
              </label>
              <textarea
                rows={3}
                value={hero.subheadline}
                onChange={(e) => setHero({ ...hero, subheadline: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Hero Video URL (MP4/WebM)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={hero.heroVideoUrl}
                    onChange={(e) =>
                      setHero({ ...hero, heroVideoUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="flex-1 rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                  />
                  <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-neutral-200 hover:border-white/35">
                    {uploadingField === "heroVideoUrl" ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], "heroVideoUrl")
                      }
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Hero Poster Image URL (JPG/PNG/WebP)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={hero.heroPosterUrl}
                    onChange={(e) =>
                      setHero({ ...hero, heroPosterUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="flex-1 rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white focus:border-[#7C5CFF] focus:outline-none"
                  />
                  <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-neutral-200 hover:border-white/35">
                    {uploadingField === "heroPosterUrl" ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], "heroPosterUrl")
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Kinetic Metrics Band</h2>
                <p className="text-xs text-neutral-400">
                  Section key: <code className="text-neutral-200">home.stats</code>
                </p>
              </div>
              <button
                type="button"
                disabled={savingKey === "home.stats"}
                onClick={() => saveSection("home.stats", { items: stats })}
                className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50 sm:text-sm"
              >
                {savingKey === "home.stats" ? "Saving..." : "Save Stats Band"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2.5 rounded-2xl border border-white/10 bg-[#050505] p-4"
                >
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400">
                      Value
                    </label>
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => {
                        const next = [...stats];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setStats(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0D0D10] px-3 py-2 text-sm font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400">
                      Label
                    </label>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const next = [...stats];
                        next[idx] = { ...next[idx], label: e.target.value };
                        setStats(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0D0D10] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400">
                      Accent Color (Hex)
                    </label>
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => {
                        const next = [...stats];
                        next[idx] = { ...next[idx], color: e.target.value };
                        setStats(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0D0D10] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">App Announcement Banner</h2>
                <p className="text-xs text-neutral-400">
                  Section key: <code className="text-neutral-200">app.banner</code>
                </p>
              </div>
              <button
                type="button"
                disabled={savingKey === "app.banner"}
                onClick={() => saveSection("app.banner", banner)}
                className="rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50 sm:text-sm"
              >
                {savingKey === "app.banner" ? "Saving..." : "Save Banner"}
              </button>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-medium text-neutral-200">
              <input
                type="checkbox"
                checked={banner.enabled}
                onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-[#050505]"
              />
              <span>Enable announcement banner in app</span>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-neutral-300">
                  Banner Message
                </label>
                <input
                  type="text"
                  value={banner.message}
                  onChange={(e) => setBanner({ ...banner, message: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  CTA Text
                </label>
                <input
                  type="text"
                  value={banner.ctaText}
                  onChange={(e) => setBanner({ ...banner, ctaText: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050505] px-3.5 py-2.5 text-sm text-white"
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: USERS & CREDITS */}
      {activeTab === "users" && (
        <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Users &amp; Account Credits</h2>
              <p className="text-xs text-neutral-400">
                Inspect emails, profiles, credit balances, and admin privileges.
              </p>
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search email, name, or user ID..."
              className="w-full rounded-xl border border-white/15 bg-[#050505] px-4 py-2.5 text-sm text-white sm:w-80"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400">
                  <th className="py-3 pr-4">User / Email</th>
                  <th className="py-3 pr-4">Username</th>
                  <th className="py-3 pr-4">Credits</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="text-neutral-200">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-white">
                        {u.full_name || "Unnamed User"}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {u.email || u.id}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-neutral-300">
                      {u.username || "—"}
                    </td>
                    <td className="py-3.5 pr-4 font-bold text-[#C4B5FD]">
                      {u.credits ?? 0}
                    </td>
                    <td className="py-3.5 pr-4">
                      {u.is_admin ? (
                        <span className="rounded-full bg-[#7C5CFF]/20 px-2.5 py-1 text-xs font-semibold text-[#C4B5FD]">
                          Admin
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-neutral-400">
                          User
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-xs text-neutral-400">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: API COSTS & ISSUES */}
      {activeTab === "monitoring" && (
        <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">API Usage, Costs &amp; Error Feed</h2>
              <p className="text-xs text-neutral-400">
                Track AI/API calls, estimated spend, credit deductions, and failed requests.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <input
                type="checkbox"
                checked={onlyErrors}
                onChange={(e) => setOnlyErrors(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#050505]"
              />
              <span>Show errors only</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400">
                  <th className="py-3 pr-4">Provider / Endpoint</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Cost (USD)</th>
                  <th className="py-3 pr-4">Credits</th>
                  <th className="py-3">Error / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((row) => {
                  const isErr = String(row.status).toLowerCase() === "error";
                  return (
                    <tr key={row.id} className="text-neutral-200">
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-white">
                          {row.provider}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {row.endpoint}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isErr
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-xs">
                        ${Number(row.estimated_cost_usd || 0).toFixed(5)}
                      </td>
                      <td className="py-3.5 pr-4 text-xs">
                        {row.credits_charged ?? 0}
                      </td>
                      <td className="py-3.5 text-xs">
                        {row.error_message ? (
                          <div className="text-rose-300">{row.error_message}</div>
                        ) : (
                          <div className="text-neutral-400">No error</div>
                        )}
                        <div className="text-[11px] text-neutral-500">
                          {new Date(row.created_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">
                      No API logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: PAYMENTS, SUBSCRIPTIONS & AUDIT TRAIL */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 space-y-4">
              <h2 className="text-lg font-bold">Subscriptions &amp; Period Dates</h2>
              <p className="text-xs text-neutral-400">
                Live plan status, start dates, renewal/end dates, and cancellations per user.
              </p>
              <div className="space-y-2.5">
                {(overview?.subscriptions ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-white/10 bg-[#050505] p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>
                        {s.plan_tier} ({s.billing_cycle}) &middot; {s.provider}
                      </span>
                      <span className="uppercase text-emerald-300">
                        {s.status}
                        {s.cancel_at_period_end ? " (Cancel at end)" : ""}
                      </span>
                    </div>
                    <div className="text-neutral-400">User ID: {s.user_id}</div>
                    <div className="text-neutral-400">
                      Start: {new Date(s.current_period_start).toLocaleString()} &rarr; End:{" "}
                      {new Date(s.current_period_end).toLocaleString()}
                    </div>
                  </div>
                ))}
                {(overview?.subscriptions ?? []).length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No subscription records yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 space-y-4">
              <h2 className="text-lg font-bold">Billing &amp; Repayment Ledger</h2>
              <p className="text-xs text-neutral-400">
                Records initial payments, renewals/repayments, upgrades, cancellations, refunds, and invoices.
              </p>
              <div className="space-y-2.5">
                {(overview?.billingTransactions ?? []).map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-2xl border border-white/10 bg-[#050505] p-3.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>
                        {tx.event_kind.toUpperCase()} &middot; {tx.plan_tier} ({tx.billing_cycle})
                      </span>
                      <span className="text-emerald-300">
                        {(tx.amount_cents / 100).toFixed(2)} {tx.currency.toUpperCase()} ({tx.status})
                      </span>
                    </div>
                    <div className="text-neutral-400">
                      {tx.customer_email ? `${tx.customer_email} · ` : ""}
                      {new Date(tx.occurred_at).toLocaleString()}
                      {tx.invoice_number ? ` · Inv #${tx.invoice_number}` : ""}
                    </div>
                    {(tx.hosted_invoice_url || tx.invoice_pdf_url) && (
                      <div className="flex gap-3 pt-0.5">
                        {tx.hosted_invoice_url && (
                          <a
                            href={tx.hosted_invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#C4B5FD] underline"
                          >
                            Hosted Invoice
                          </a>
                        )}
                        {tx.invoice_pdf_url && (
                          <a
                            href={tx.invoice_pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-300 underline"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(overview?.billingTransactions ?? []).length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No billing transactions recorded yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 space-y-4">
              <h2 className="text-lg font-bold">Payment Webhook Ledger</h2>
              <p className="text-xs text-neutral-400">
                Idempotent webhook events recorded for payment gateway safety.
              </p>
              <div className="space-y-2.5">
                {(overview?.webhooks ?? []).map((w) => (
                  <div
                    key={w.id}
                    className="rounded-2xl border border-white/10 bg-[#050505] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>
                        {w.provider} · {w.event_type}
                      </span>
                      <span className="text-emerald-300">{w.status}</span>
                    </div>
                    <div className="mt-1 text-neutral-400">Event: {w.event_id}</div>
                  </div>
                ))}
                {(overview?.webhooks ?? []).length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No payment webhook events yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 space-y-4">
              <h2 className="text-lg font-bold">Admin Audit Trail</h2>
              <p className="text-xs text-neutral-400">
                Tracks CMS edits, media uploads, and administrative actions.
              </p>
              <div className="space-y-2.5">
                {(overview?.auditLogs ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-white/10 bg-[#050505] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{a.action}</span>
                      <span className="text-neutral-400">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-neutral-400">
                      Target: {a.target_type}
                      {a.target_id ? ` (${a.target_id})` : ""}
                    </div>
                  </div>
                ))}
                {(overview?.auditLogs ?? []).length === 0 && (
                  <p className="py-6 text-center text-xs text-neutral-400">
                    No audit records yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
      {/* TAB 5: CHAAR ESCALATIONS & WATCHDOG */}
      {activeTab === "watchdog" && (
        <section className="rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Chaar Escalations &amp; Watchdog Alerts</h2>
              <p className="text-xs text-neutral-400">
                Review user issues escalated through Chaar and automated system health probes, and resolve tickets in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["open", "acknowledged", "resolved", "all"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setWatchdogFilter(filterKey)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
                    watchdogFilter === filterKey
                      ? "bg-[#7C5CFF] text-white"
                      : "border border-white/10 bg-[#050505] text-neutral-300 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {filterKey}
                  {filterKey === "open" ? ` (${watchdogSummary.open})` : ""}
                  {filterKey === "acknowledged" ? ` (${watchdogSummary.acknowledged})` : ""}
                  {filterKey === "resolved" ? ` (${watchdogSummary.resolved})` : ""}
                </button>
              ))}
              <button
                type="button"
                onClick={loadWatchdog}
                disabled={loadingWatchdog}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 hover:border-white/35 hover:text-white disabled:opacity-50"
              >
                {loadingWatchdog ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {watchdogIncidents
              .filter((inc) => watchdogFilter === "all" || inc.status === watchdogFilter)
              .map((inc) => {
                const matchedUser = inc.affected_user_id
                  ? (overview?.users ?? []).find((u) => u.id === inc.affected_user_id)
                  : null;
                const isChaarTicket = inc.source === "robo_escalation";

                return (
                  <div
                    key={inc.id}
                    className="rounded-2xl border border-white/10 bg-[#050505] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                              isChaarTicket
                                ? "bg-violet-500/20 text-violet-300 border border-violet-400/30"
                                : "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                            }`}
                          >
                            {isChaarTicket ? "Chaar Escalation" : "Watchdog Probe"}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                              inc.severity === "critical"
                                ? "bg-red-500/20 text-red-300"
                                : inc.severity === "warning"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-neutral-500/20 text-neutral-300"
                            }`}
                          >
                            {inc.severity}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                              inc.status === "open"
                                ? "bg-rose-500/20 text-rose-300"
                                : inc.status === "acknowledged"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {inc.status}
                          </span>

                          {inc.occurrence_count > 1 && (
                            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300">
                              {inc.occurrence_count}x reported
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-white">{inc.title}</h3>
                        <p className="text-xs leading-relaxed text-neutral-300">
                          {inc.summary}
                        </p>

                        {inc.recommended_action && (
                          <p className="text-xs text-neutral-400">
                            <span className="font-semibold text-neutral-200">Next step:</span>{" "}
                            {inc.recommended_action}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-neutral-400">
                          {matchedUser?.email && (
                            <span>
                              User: <strong className="text-neutral-200">{matchedUser.email}</strong>
                            </span>
                          )}
                          {!matchedUser?.email && inc.affected_user_id && (
                            <span>
                              User ID: <code className="text-neutral-300">{inc.affected_user_id}</code>
                            </span>
                          )}
                          {inc.affected_route_or_feature && (
                            <span>
                              Route: <code className="text-violet-300">{inc.affected_route_or_feature}</code>
                            </span>
                          )}
                          <span>
                            Last seen: {new Date(inc.last_seen_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {inc.status === "open" && (
                          <button
                            type="button"
                            disabled={updatingIncidentId === inc.id}
                            onClick={() => handleUpdateIncidentStatus(inc.id, "acknowledged")}
                            className="rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
                          >
                            Acknowledge
                          </button>
                        )}
                        {inc.status !== "resolved" ? (
                          <button
                            type="button"
                            disabled={updatingIncidentId === inc.id}
                            onClick={() => handleUpdateIncidentStatus(inc.id, "resolved")}
                            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {updatingIncidentId === inc.id ? "Saving..." : "Mark Resolved"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={updatingIncidentId === inc.id}
                            onClick={() => handleUpdateIncidentStatus(inc.id, "open")}
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition hover:border-white/35 hover:text-white disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {watchdogIncidents.filter(
              (inc) => watchdogFilter === "all" || inc.status === watchdogFilter
            ).length === 0 && (
              <p className="py-8 text-center text-xs text-neutral-400">
                No {watchdogFilter === "all" ? "" : watchdogFilter} Chaar or Watchdog incidents right now.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}


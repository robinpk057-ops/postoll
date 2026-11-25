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

type AdminTab = "cms" | "users" | "monitoring" | "security";

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

type OverviewResponse = {
  summary: {
    totalUsers: number;
    totalApiCalls: number;
    errorCount: number;
    totalApiCostUsd: number;
    totalCreditsCharged: number;
    webhookEventsCount: number;
  };
  users: UserRow[];
  apiLogs: ApiLogRow[];
  webhooks: WebhookRow[];
  auditLogs: AuditRow[];
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
          onClick={() => loadOverview(true)}
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

      {/* TAB 4: PAYMENTS & AUDIT TRAIL */}
      {activeTab === "security" && (
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
      )}
    </div>
  );
}

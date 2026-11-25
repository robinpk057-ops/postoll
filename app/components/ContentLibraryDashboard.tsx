"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_HERO_CONTENT, type HeroCmsContent } from "@/lib/cms-defaults";

type ContentType =
  | "all"
  | "post"
  | "reel"
  | "image"
  | "video";

type ContentStatus =
  | "all"
  | "draft"
  | "queued"
  | "approved"
  | "scheduled"
  | "published";

type DbContentRow = {
  id: string;
  user_id: string;
  title: string | null;
  idea: string | null;
  caption: string | null;
  content_type: string | null;
  type: string | null;
  status: string | null;
  schedule_status: string | null;
  platform: string | null;
  image_url: string | null;
  created_at: string;
};

type ContentItem = {
  id: string;
  title: string;
  type: Exclude<ContentType, "all">;
  status: string;
  source: "AI Generated" | "Uploaded";
  platform: string;
  createdAt: string;
  description: string;
  imageUrl: string | null;
};

const STUDIO_VIDEO_SHOWCASE = [
  {
    title: "30s Product Launch Reel",
    tag: "AI REEL · 9:16",
    duration: "0:30",
    gradient: "from-[#7C5CFF] via-[#A855F7] to-[#EC4899]",
    href: "/create",
    cta: "Generate Reel",
  },
  {
    title: "Daily Autopilot Slot Queue",
    tag: "WORKFLOW · CRON",
    duration: "24/7",
    gradient: "from-[#10B981] via-[#059669] to-[#0EA5E9]",
    href: "/workflows",
    cta: "Open Workflows",
  },
  {
    title: "Multi-Channel Calendar Grid",
    tag: "CALENDAR · SYNC",
    duration: "LIVE",
    gradient: "from-[#F59E0B] via-[#F97316] to-[#EC4899]",
    href: "/calendar",
    cta: "View Calendar",
  },
  {
    title: "Connected Social Channels",
    tag: "ACCOUNTS · OAUTH",
    duration: "6 APPS",
    gradient: "from-[#38BDF8] via-[#6366F1] to-[#A855F7]",
    href: "/accounts",
    cta: "Manage Accounts",
  },
];

const filters: {
  id: ContentType;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "post", label: "Posts" },
  { id: "reel", label: "Reels" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
];

const statusFilters: {
  id: ContentStatus;
  label: string;
}[] = [
  { id: "all", label: "All status" },
  { id: "queued", label: "Queued" },
  { id: "draft", label: "Draft" },
  { id: "approved", label: "Approved" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

function normalizeType(raw: string | null): Exclude<ContentType, "all"> {
  const val = (raw || "").toLowerCase();
  if (val === "reel" || val === "reels") return "reel";
  if (val === "video" || val === "videos") return "video";
  if (val === "image" || val === "images") return "image";
  return "post";
}

function getTypeLabel(type: ContentItem["type"]) {
  switch (type) {
    case "post":
      return "Post";
    case "reel":
      return "Reel";
    case "image":
      return "Image";
    case "video":
      return "Video";
  }
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-purple-500/15 text-purple-300 border border-purple-500/30";
    case "scheduled":
    case "queued":
    case "publishing":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
    case "published":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    case "failed":
      return "bg-rose-500/15 text-rose-300 border border-rose-500/30";
    default:
      return "bg-white/10 text-neutral-300 border border-white/15";
  }
}

function formatCreatedAt(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function ContentLibraryDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroMedia, setHeroMedia] = useState<{
    heroVideoUrl: string;
    heroPosterUrl: string;
  }>({
    heroVideoUrl: DEFAULT_HERO_CONTENT.heroVideoUrl,
    heroPosterUrl: DEFAULT_HERO_CONTENT.heroPosterUrl,
  });

  const [typeFilter, setTypeFilter] = useState<ContentType>("all");
  const [statusFilter, setStatusFilter] = useState<ContentStatus>("all");
  const [search, setSearch] = useState("");

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("content")
        .select(
          "id, user_id, title, idea, caption, content_type, type, status, schedule_status, platform, image_url, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const mapped: ContentItem[] = ((data as DbContentRow[]) || []).map(
        (row) => {
          const effectiveStatus = (
            row.status ||
            row.schedule_status ||
            "draft"
          ).toLowerCase();

          return {
            id: row.id,
            title: row.title || row.idea || "Untitled creative",
            type: normalizeType(row.type || row.content_type),
            status: effectiveStatus,
            source: "AI Generated",
            platform: row.platform || "Workflow",
            createdAt: formatCreatedAt(row.created_at),
            description:
              row.caption || row.idea || "Your Postoll creative.",
            imageUrl: row.image_url,
          };
        }
      );

      setItems(mapped);
    } catch (err) {
      console.error("Load content library error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your content library."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const isRecovery = /type=recovery/.test(window.location.hash || "");
    if (code || isRecovery) {
      const target = code
        ? `/login?mode=update&code=${encodeURIComponent(code)}`
        : "/login?mode=update";
      window.location.replace(target);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("site_content")
          .select("content")
          .eq("section_key", "home.hero")
          .maybeSingle();

        if (active && data?.content && typeof data.content === "object") {
          const c = data.content as Partial<HeroCmsContent>;
          setHeroMedia({
            heroVideoUrl: c.heroVideoUrl || "",
            heroPosterUrl: c.heroPosterUrl || "",
          });
        }
      } catch {
        // Ignore optional CMS media fetch errors
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const stats = useMemo(() => {
    const total = items.length;
    const scheduled = items.filter(
      (i) => i.status === "scheduled" || i.status === "queued"
    ).length;
    const published = items.filter(
      (i) => i.status === "published"
    ).length;

    return {
      total,
      aiGenerated: total,
      scheduled,
      published,
    };
  }, [items]);

  const filteredContent = useMemo(() => {
    return items.filter((item) => {
      const matchesType =
        typeFilter === "all" || item.type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        item.status.toLowerCase() === statusFilter;

      const searchValue = search.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        item.title.toLowerCase().includes(searchValue) ||
        item.description.toLowerCase().includes(searchValue) ||
        item.platform.toLowerCase().includes(searchValue);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [items, typeFilter, statusFilter, search]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        {/* LEONARDO-STYLE HERO BANNER WITH QUICK ACTION BUTTONS & VIDEO/MOTION STAGE */}
        <section
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-8 lg:p-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,92,255,0.22) 0%, rgba(16,16,22,0.96) 52%, rgba(236,72,153,0.18) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#C4B5FD]">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Postoll AI Creation &amp; Autopilot Hub</span>
              </div>

              <h1
                className="font-black uppercase tracking-tight text-white"
                style={{
                  fontSize: "clamp(1.85rem, 4vw, 3.25rem)",
                  lineHeight: 1.02,
                }}
              >
                CREATE, AUTOMATE &amp; PUBLISH AT STUDIO SPEED
              </h1>

              <p
                className="max-w-2xl text-sm leading-relaxed sm:text-base"
                style={{ color: "var(--muted)" }}
              >
                Launch automated AI workflows, manage your publishing calendar, and connect social channels from one vibrant studio—or jump straight into your library below.
              </p>

              {/* Quick Studio Buttons (Workflows, Calendar, Accounts, Create) */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#6A48F5]"
                >
                  <span>✦</span>
                  <span>Create Content</span>
                </Link>
                <Link
                  href="/workflows"
                  className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/35 bg-sky-500/15 px-4 py-3 text-sm font-bold text-sky-200 transition hover:bg-sky-500/25"
                >
                  <span>◈</span>
                  <span>Workflows</span>
                </Link>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/35 bg-amber-500/15 px-4 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <span>◫</span>
                  <span>Calendar</span>
                </Link>
                <Link
                  href="/accounts"
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  <span>◎</span>
                  <span>Accounts</span>
                </Link>
              </div>
            </div>

            {/* Playing AI Video / Motion Stage */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#09090D] shadow-2xl">
                {heroMedia.heroVideoUrl ? (
                  <video
                    src={heroMedia.heroVideoUrl}
                    poster={heroMedia.heroPosterUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#2E1065] via-[#0F172A] to-[#4C0519] p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="rounded-full bg-white/15 px-3 py-1 text-white backdrop-blur-xs">
                        ▶ AI REEL &amp; MOTION PREVIEW
                      </span>
                      <span className="rounded-full bg-emerald-500/25 px-2.5 py-1 text-emerald-200">
                        LIVE STUDIO
                      </span>
                    </div>

                    <div className="my-auto grid grid-cols-3 gap-2.5 py-2">
                      <div className="rounded-xl border border-white/15 bg-gradient-to-tr from-[#7C5CFF] to-[#38BDF8] p-3 text-white shadow-md">
                        <p className="text-[11px] font-black uppercase">Reels</p>
                        <p className="mt-1 text-[10px] text-white/85">Auto-cut hooks</p>
                      </div>
                      <div className="rounded-xl border border-white/20 bg-gradient-to-tr from-[#EC4899] to-[#F59E0B] p-3 text-white shadow-lg -translate-y-1">
                        <p className="text-[11px] font-black uppercase">Slots</p>
                        <p className="mt-1 text-[10px] text-white/90">Smart queue</p>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-gradient-to-tr from-[#10B981] to-[#6366F1] p-3 text-white shadow-md">
                        <p className="text-[11px] font-black uppercase">Publish</p>
                        <p className="mt-1 text-[10px] text-white/85">Multi-channel</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-300">
                      <span>Scroll below for AI showcase &amp; library</span>
                      <span className="font-bold text-[#C4B5FD]">Postoll Studio</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SCROLL SHOWCASE: AI VIDEOS & STUDIO MODULES */}
        <section className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#EC4899]">
                ✦ Studio Showcase
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                AI Reels, Workflows &amp; Publishing Tools
              </h2>
            </div>
            <Link
              href="/workflows/create"
              className="text-xs font-bold text-[#C4B5FD] hover:underline sm:text-sm"
            >
              + Launch new workflow →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STUDIO_VIDEO_SHOWCASE.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group overflow-hidden rounded-2xl border transition hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className={`flex h-32 flex-col justify-between bg-gradient-to-br ${card.gradient} p-4 text-white`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                    <span className="rounded-full bg-black/30 px-2.5 py-0.5 backdrop-blur-xs">
                      {card.tag}
                    </span>
                    <span className="rounded-full bg-black/30 px-2 py-0.5">
                      {card.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                      ▶
                    </span>
                    <span>Interactive Studio Preview</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold">{card.title}</h3>
                  <p className="mt-2 text-xs font-bold text-[#C4B5FD] group-hover:underline">
                    {card.cta} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CONTENT LIBRARY SECTION (PRESERVED LOGIC + COLORFUL STATS) */}
        <section className="mt-12 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
                ✦ Your content
              </p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                Content Library
              </h2>
              <p
                className="mt-1.5 max-w-2xl text-sm"
                style={{ color: "var(--muted)" }}
              >
                Manage everything Postoll creates, everything you upload, and everything you plan to publish.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/create")}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              + Create content
            </button>
          </div>

          {/* Colorful Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total content", value: String(stats.total), accent: "#7C5CFF" },
              { label: "AI generated", value: String(stats.aiGenerated), accent: "#EC4899" },
              { label: "Queued / Scheduled", value: String(stats.scheduled), accent: "#38BDF8" },
              { label: "Published", value: String(stats.published), accent: "#10B981" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border p-5"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {item.label}
                  </p>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.accent }}
                  />
                </div>
                <p
                  className="mt-2 text-2xl font-bold"
                  style={{ color: item.accent }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div
            className="rounded-2xl border p-5"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search your content..."
                  className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const active = typeFilter === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setTypeFilter(filter.id)}
                      className="rounded-full border px-4 py-2 text-sm transition"
                      style={{
                        borderColor: active ? "#8b5cf6" : "var(--border)",
                        background: active
                          ? "rgba(139, 92, 246, 0.14)"
                          : "transparent",
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => {
                  const active = statusFilter === filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setStatusFilter(filter.id)}
                      className="rounded-full border px-4 py-2 text-sm transition"
                      style={{
                        borderColor: active
                          ? "var(--foreground)"
                          : "var(--border)",
                        background: active
                          ? "var(--card-hover)"
                          : "transparent",
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Content Items */}
          <div className="space-y-4">
            {loading ? (
              <div
                className="rounded-2xl border p-12 text-center text-sm"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--muted)",
                }}
              >
                Loading your content...
              </div>
            ) : filteredContent.length === 0 ? (
              <div
                className="rounded-2xl border p-12 text-center"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-xl">
                  ✦
                </div>

                <h3 className="mt-5 text-lg font-semibold">No content found</h3>

                <p
                  className="mx-auto mt-2 max-w-md text-sm"
                  style={{ color: "var(--muted)" }}
                >
                  Try changing your filters or create something new with Postoll.
                </p>
              </div>
            ) : (
              filteredContent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border p-5 transition hover:-translate-y-0.5"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-xl"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--card-hover)",
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : item.type === "reel" ? (
                          "▶"
                        ) : item.type === "video" ? (
                          "◈"
                        ) : (
                          "✦"
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{item.title}</h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <p
                          className="mt-1 text-sm"
                          style={{ color: "var(--muted)" }}
                        >
                          {item.description}
                        </p>

                        <div
                          className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          <span>{getTypeLabel(item.type)}</span>
                          <span>{item.source}</span>
                          <span>{item.platform}</span>
                          <span>{item.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => router.push(`/content/${item.id}`)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COPYRIGHT & STUDIO FOOTER */}
        <footer
          className="mt-14 flex flex-col justify-between gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <p>© {new Date().getFullYear()} Postoll. AI Social Studio &amp; Scheduler.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/workflows" className="hover:underline">
              Workflows
            </Link>
            <Link href="/calendar" className="hover:underline">
              Calendar
            </Link>
            <Link href="/accounts" className="hover:underline">
              Accounts
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}

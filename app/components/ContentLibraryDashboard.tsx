"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_HERO_CONTENT, type HeroCmsContent } from "@/lib/cms-defaults";

type GalleryCategory =
  | "all"
  | "reels"
  | "posts"
  | "workflows"
  | "brand"
  | "motion";

type StudioCard = {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<GalleryCategory, "all">;
  badge: string;
  gradient: string;
  sizeClass: string;
  href: string;
  cta: string;
};

const TOP_STUDIO_STRIP: StudioCard[] = [
  {
    id: "top-1",
    title: "AI Reel Director",
    subtitle: "15s & 30s vertical reels",
    category: "reels",
    badge: "REELS",
    gradient: "from-[#7C5CFF] via-[#A855F7] to-[#EC4899]",
    sizeClass: "h-44",
    href: "/create",
    cta: "Create Reel →",
  },
  {
    id: "top-2",
    title: "Autopilot Workflows",
    subtitle: "Scheduled daily series",
    category: "workflows",
    badge: "WORKFLOWS",
    gradient: "from-[#10B981] via-[#059669] to-[#0EA5E9]",
    sizeClass: "h-44",
    href: "/workflows",
    cta: "Open Workflows →",
  },
  {
    id: "top-3",
    title: "Publishing Calendar",
    subtitle: "30-day multi-slot queue",
    category: "motion",
    badge: "CALENDAR",
    gradient: "from-[#F59E0B] via-[#F97316] to-[#EC4899]",
    sizeClass: "h-44",
    href: "/calendar",
    cta: "View Calendar →",
  },
  {
    id: "top-4",
    title: "Social Channels",
    subtitle: "IG, FB, YT, LinkedIn & TikTok",
    category: "brand",
    badge: "ACCOUNTS",
    gradient: "from-[#38BDF8] via-[#6366F1] to-[#8B5CF6]",
    sizeClass: "h-44",
    href: "/accounts",
    cta: "Connect Channels →",
  },
  {
    id: "top-5",
    title: "Visual Post Studio",
    subtitle: "Captions, hooks & hashtags",
    category: "posts",
    badge: "POSTS",
    gradient: "from-[#EC4899] via-[#F43F5E] to-[#FB923C]",
    sizeClass: "h-44",
    href: "/create",
    cta: "Design Post →",
  },
];

const MULTI_SIZE_GALLERY: StudioCard[] = [
  {
    id: "gal-1",
    title: "Neon Studio Motion Reel",
    subtitle: "High-energy vertical reel with scene hooks & captions",
    category: "reels",
    badge: "9:16 REEL",
    gradient: "from-[#6D28D9] via-[#9333EA] to-[#DB2777]",
    sizeClass: "h-80 sm:h-96",
    href: "/create",
    cta: "Open in Create",
  },
  {
    id: "gal-2",
    title: "Brand Launch Campaign",
    subtitle: "Cohesive multi-channel creative direction",
    category: "brand",
    badge: "BRAND KIT",
    gradient: "from-[#0284C7] via-[#2563EB] to-[#7C3AED]",
    sizeClass: "h-64 sm:h-72",
    href: "/workflows",
    cta: "View Workflow",
  },
  {
    id: "gal-3",
    title: "Golden Hour Product Spot",
    subtitle: "Warm lighting & scroll-stopping social visual",
    category: "posts",
    badge: "SOCIAL POST",
    gradient: "from-[#D97706] via-[#EA580C] to-[#E11D48]",
    sizeClass: "h-72 sm:h-80",
    href: "/create",
    cta: "Generate Post",
  },
  {
    id: "gal-4",
    title: "Automated Slot Queue",
    subtitle: "Recurring daily slots & instant rescheduling",
    category: "workflows",
    badge: "AUTOPILOT",
    gradient: "from-[#059669] via-[#0D9488] to-[#0284C7]",
    sizeClass: "h-60 sm:h-64",
    href: "/automatic-posting",
    cta: "Setup Autopilot",
  },
  {
    id: "gal-5",
    title: "3D & Kinetic Motion Loop",
    subtitle: "Smooth transitions for short-form feeds",
    category: "motion",
    badge: "MOTION",
    gradient: "from-[#4F46E5] via-[#7C3AED] to-[#EC4899]",
    sizeClass: "h-80 sm:h-96",
    href: "/create",
    cta: "Launch Studio",
  },
  {
    id: "gal-6",
    title: "Weekly Content Calendar",
    subtitle: "Plan posts & reels across connected profiles",
    category: "brand",
    badge: "SCHEDULE",
    gradient: "from-[#BE185D] via-[#9333EA] to-[#4338CA]",
    sizeClass: "h-64 sm:h-72",
    href: "/calendar",
    cta: "Open Calendar",
  },
];

const CATEGORY_PILLS: { id: GalleryCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reels", label: "Reels" },
  { id: "posts", label: "Posts" },
  { id: "workflows", label: "Workflows" },
  { id: "brand", label: "Brand" },
  { id: "motion", label: "Motion" },
];

export default function ContentLibraryDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedCategory, setSelectedCategory] =
    useState<GalleryCategory>("all");
  const [heroMedia, setHeroMedia] = useState<{
    heroVideoUrl: string;
    heroPosterUrl: string;
  }>({
    heroVideoUrl: DEFAULT_HERO_CONTENT.heroVideoUrl,
    heroPosterUrl: DEFAULT_HERO_CONTENT.heroPosterUrl,
  });

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
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (active && !user) {
        router.push("/login");
        return;
      }

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
  }, [router, supabase]);

  const filteredGallery = useMemo(() => {
    if (selectedCategory === "all") return MULTI_SIZE_GALLERY;
    return MULTI_SIZE_GALLERY.filter(
      (item) => item.category === selectedCategory
    );
  }, [selectedCategory]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {/* HERO BANNER WITH QUICK BUTTONS + PLAYING AI VIDEO BEHIND/STAGE */}
        <section
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-8 lg:p-10"
          style={{
            background:
              "linear-gradient(125deg, rgba(124,92,255,0.24) 0%, rgba(12,12,18,0.96) 55%, rgba(236,72,153,0.2) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest text-[#C4B5FD]">
                <span>✦</span>
                <span>Postoll AI Creative Studio</span>
              </div>

              <h1
                className="font-black tracking-tight text-white"
                style={{
                  fontSize: "clamp(2rem, 4.2vw, 3.5rem)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.03em",
                }}
              >
                YOURS TO CREATE &amp; PUBLISH
              </h1>

              <p className="max-w-2xl text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
                Generate reels and social posts, run automated workflows, and
                manage your publishing schedule from one studio.
              </p>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link
                  href="/workflows"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#7C5CFF] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#6A48F5]"
                >
                  <span>◈</span>
                  <span>Workflows</span>
                </Link>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-5 py-3 text-sm font-extrabold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <span>◫</span>
                  <span>Calendar</span>
                </Link>
                <Link
                  href="/accounts"
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  <span>◎</span>
                  <span>Accounts</span>
                </Link>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 rounded-2xl border border-pink-400/40 bg-pink-500/15 px-5 py-3 text-sm font-extrabold text-pink-200 transition hover:bg-pink-500/25"
                >
                  <span>✦</span>
                  <span>Create Studio</span>
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
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[#3B0764] via-[#0F172A] to-[#831843] p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider">
                      <span className="rounded-full bg-white/15 px-3 py-1 text-white">
                        ▶ PLAYING AI STUDIO REEL
                      </span>
                      <span className="rounded-full bg-emerald-500/25 px-2.5 py-1 text-emerald-200">
                        LIVE
                      </span>
                    </div>

                    <div className="my-auto grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl border border-white/15 bg-gradient-to-br from-[#7C5CFF] to-[#38BDF8] p-3 text-white">
                        <p className="text-xs font-black">AI Reels</p>
                        <p className="mt-0.5 text-[11px] text-white/85">
                          15s &amp; 30s
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/20 bg-gradient-to-br from-[#EC4899] to-[#F59E0B] p-3 text-white -translate-y-1">
                        <p className="text-xs font-black">Workflows</p>
                        <p className="mt-0.5 text-[11px] text-white/90">
                          Auto queue
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-gradient-to-br from-[#10B981] to-[#6366F1] p-3 text-white">
                        <p className="text-xs font-black">Publish</p>
                        <p className="mt-0.5 text-[11px] text-white/85">
                          All channels
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                      <span>Scroll down for studio gallery</span>
                      <span className="text-[#C4B5FD]">Postoll</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* TOP HORIZONTAL STUDIO CARDS (LIKE LEONARDO TOP ROW) */}
        <section className="mt-8">
          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {TOP_STUDIO_STRIP.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 transition hover:-translate-y-0.5"
              >
                <div
                  className={`flex ${card.sizeClass} flex-col justify-between bg-gradient-to-br ${card.gradient} p-4 text-white`}
                >
                  <span className="w-fit rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-black tracking-wider">
                    {card.badge}
                  </span>
                  <div>
                    <h2 className="text-base font-black tracking-tight">
                      {card.title}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-white/85">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* FILTER PILLS BAR */}
        <section className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_PILLS.map((pill) => {
              const active = selectedCategory === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedCategory(pill.id)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
                    active
                      ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
                      : "border-white/12 bg-[#121218] text-neutral-300 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <Link
            href="/create"
            className="text-xs font-extrabold text-[#C4B5FD] hover:underline sm:text-sm"
          >
            + Create new visual →
          </Link>
        </section>

        {/* MULTI-SIZE VISUAL GALLERY BELOW (REPLACING CONTENT LIBRARY) */}
        <section className="mt-6">
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGallery.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group relative overflow-hidden rounded-3xl border border-white/10 transition hover:-translate-y-0.5"
              >
                <div
                  className={`flex ${item.sizeClass} flex-col justify-between bg-gradient-to-br ${item.gradient} p-6 text-white`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-black uppercase tracking-wider">
                      {item.badge}
                    </span>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
                      ▶ Studio
                    </span>
                  </div>

                  <div>
                    <h3
                      className="font-black tracking-tight text-white"
                      style={{
                        fontSize: "clamp(1.25rem, 2vw, 1.65rem)",
                        lineHeight: 1.1,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm font-medium text-white/90">
                      {item.subtitle}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 rounded-xl bg-black/35 px-3.5 py-1.5 text-xs font-extrabold text-white transition group-hover:bg-black/55">
                      {item.cta} →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* COPYRIGHT FOOTER */}
        <footer
          className="mt-12 flex flex-col justify-between gap-3 border-t pt-6 text-xs font-medium sm:flex-row sm:items-center"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <p>© {new Date().getFullYear()} Postoll. All rights reserved.</p>
          <div className="flex flex-wrap gap-4 font-semibold">
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

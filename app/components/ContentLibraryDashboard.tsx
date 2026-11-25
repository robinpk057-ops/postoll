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

export type StudioShowcaseCard = {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<GalleryCategory, "all">;
  badge: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  fallbackGradient: string;
  sizeClass: string;
  href: string;
  cta: string;
};

const DEFAULT_HERO_SAMPLE_VIDEO =
  "https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-network-connections-27611-large.mp4";
const DEFAULT_HERO_SAMPLE_POSTER =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80";

const TOP_STUDIO_STRIP: StudioShowcaseCard[] = [
  {
    id: "top-1",
    title: "AI Reel Director",
    subtitle: "15s & 30s vertical reels",
    category: "reels",
    badge: "REELS",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=900&q=80",
    fallbackGradient: "from-[#7C5CFF] via-[#A855F7] to-[#EC4899]",
    sizeClass: "h-52",
    href: "/create",
    cta: "Create Reel →",
  },
  {
    id: "top-2",
    title: "Autopilot Workflows",
    subtitle: "Scheduled daily series",
    category: "workflows",
    badge: "WORKFLOWS",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=900&q=80",
    fallbackGradient: "from-[#10B981] via-[#059669] to-[#0EA5E9]",
    sizeClass: "h-52",
    href: "/workflows",
    cta: "Open Workflows →",
  },
  {
    id: "top-3",
    title: "Publishing Calendar",
    subtitle: "30-day multi-slot queue",
    category: "motion",
    badge: "CALENDAR",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=900&q=80",
    fallbackGradient: "from-[#F59E0B] via-[#F97316] to-[#EC4899]",
    sizeClass: "h-52",
    href: "/calendar",
    cta: "View Calendar →",
  },
  {
    id: "top-4",
    title: "Social Channels",
    subtitle: "IG, FB, YT, LinkedIn & TikTok",
    category: "brand",
    badge: "ACCOUNTS",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1618172193763-c511deb635ca?auto=format&fit=crop&w=900&q=80",
    fallbackGradient: "from-[#38BDF8] via-[#6366F1] to-[#8B5CF6]",
    sizeClass: "h-52",
    href: "/accounts",
    cta: "Connect Channels →",
  },
  {
    id: "top-5",
    title: "Visual Post Studio",
    subtitle: "Captions, hooks & hashtags",
    category: "posts",
    badge: "POSTS",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?auto=format&fit=crop&w=900&q=80",
    fallbackGradient: "from-[#EC4899] via-[#F43F5E] to-[#FB923C]",
    sizeClass: "h-52",
    href: "/create",
    cta: "Design Post →",
  },
];

const DEFAULT_MULTI_SIZE_GALLERY: StudioShowcaseCard[] = [
  {
    id: "gal-1",
    title: "Neon Studio Motion Reel",
    subtitle: "High-energy vertical reel with scene hooks & captions",
    category: "reels",
    badge: "9:16 VIDEO",
    mediaType: "video",
    mediaUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-ink-swirling-in-water-in-slow-motion-218-large.mp4",
    posterUrl:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#6D28D9] via-[#9333EA] to-[#DB2777]",
    sizeClass: "h-[380px] sm:h-[440px]",
    href: "/create",
    cta: "Create Similar Reel",
  },
  {
    id: "gal-2",
    title: "Brand Launch Campaign",
    subtitle: "Cohesive multi-channel creative direction & copy",
    category: "brand",
    badge: "BRAND POST",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#0284C7] via-[#2563EB] to-[#7C3AED]",
    sizeClass: "h-[280px] sm:h-[320px]",
    href: "/workflows",
    cta: "Open Workflows",
  },
  {
    id: "gal-3",
    title: "Golden Hour Product Spot",
    subtitle: "Warm editorial lighting & scroll-stopping caption",
    category: "posts",
    badge: "SOCIAL POST",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#D97706] via-[#EA580C] to-[#E11D48]",
    sizeClass: "h-[330px] sm:h-[380px]",
    href: "/create",
    cta: "Generate Post",
  },
  {
    id: "gal-4",
    title: "Automated Daily Slot Queue",
    subtitle: "Recurring daily slots & next-day rescheduling",
    category: "workflows",
    badge: "AUTOPILOT",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#059669] via-[#0D9488] to-[#0284C7]",
    sizeClass: "h-[270px] sm:h-[310px]",
    href: "/automatic-posting",
    cta: "Setup Autopilot",
  },
  {
    id: "gal-5",
    title: "Kinetic Light & Motion Loop",
    subtitle: "Smooth transitions built for Reels & YouTube Shorts",
    category: "motion",
    badge: "AI MOTION",
    mediaType: "video",
    mediaUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
    posterUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#4F46E5] via-[#7C3AED] to-[#EC4899]",
    sizeClass: "h-[380px] sm:h-[440px]",
    href: "/create",
    cta: "Launch Video Studio",
  },
  {
    id: "gal-6",
    title: "Multi-Account Social Calendar",
    subtitle: "Schedule posts & reels across connected profiles",
    category: "brand",
    badge: "CALENDAR",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#BE185D] via-[#9333EA] to-[#4338CA]",
    sizeClass: "h-[300px] sm:h-[340px]",
    href: "/calendar",
    cta: "View Calendar",
  },
  {
    id: "gal-7",
    title: "Cyberpunk Neon Visual Reel",
    subtitle: "Vivid color grading & fast short-form storytelling",
    category: "reels",
    badge: "AI REEL",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#7C3AED] via-[#C026D3] to-[#F43F5E]",
    sizeClass: "h-[310px] sm:h-[360px]",
    href: "/create",
    cta: "Create AI Reel",
  },
  {
    id: "gal-8",
    title: "Abstract Fluid Motion Study",
    subtitle: "Looping generative motion for social backgrounds",
    category: "motion",
    badge: "LOOP VIDEO",
    mediaType: "video",
    mediaUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-pink-and-purple-tunnel-5357-large.mp4",
    posterUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#9333EA] via-[#EC4899] to-[#F59E0B]",
    sizeClass: "h-[360px] sm:h-[420px]",
    href: "/create",
    cta: "Generate Motion",
  },
  {
    id: "gal-9",
    title: "Editorial Lifestyle Feed Post",
    subtitle: "Clean composition with tailored captions & tags",
    category: "posts",
    badge: "FEED POST",
    mediaType: "image",
    mediaUrl:
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1000&q=80",
    fallbackGradient: "from-[#0EA5E9] via-[#6366F1] to-[#A855F7]",
    sizeClass: "h-[280px] sm:h-[320px]",
    href: "/create",
    cta: "Create Post",
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

function GalleryMedia({ card }: { card: StudioShowcaseCard }) {
  const [failed, setFailed] = useState(false);

  if (failed || !card.mediaUrl) {
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-br ${card.fallbackGradient}`}
      />
    );
  }

  if (card.mediaType === "video") {
    return (
      <video
        src={card.mediaUrl}
        poster={card.posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.mediaUrl}
      alt={card.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

export default function ContentLibraryDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedCategory, setSelectedCategory] =
    useState<GalleryCategory>("all");
  const [galleryItems, setGalleryItems] = useState<StudioShowcaseCard[]>(
    DEFAULT_MULTI_SIZE_GALLERY
  );
  const [heroMedia, setHeroMedia] = useState<{
    heroVideoUrl: string;
    heroPosterUrl: string;
  }>({
    heroVideoUrl:
      DEFAULT_HERO_CONTENT.heroVideoUrl || DEFAULT_HERO_SAMPLE_VIDEO,
    heroPosterUrl:
      DEFAULT_HERO_CONTENT.heroPosterUrl || DEFAULT_HERO_SAMPLE_POSTER,
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
          .select("section_key, content")
          .in("section_key", ["home.hero", "home.gallery"]);

        if (!active || !Array.isArray(data)) return;

        for (const row of data) {
          if (
            row.section_key === "home.hero" &&
            row.content &&
            typeof row.content === "object"
          ) {
            const c = row.content as Partial<HeroCmsContent>;
            setHeroMedia({
              heroVideoUrl: c.heroVideoUrl || DEFAULT_HERO_SAMPLE_VIDEO,
              heroPosterUrl: c.heroPosterUrl || DEFAULT_HERO_SAMPLE_POSTER,
            });
          }

          if (
            row.section_key === "home.gallery" &&
            row.content &&
            typeof row.content === "object"
          ) {
            const items = (row.content as { items?: StudioShowcaseCard[] })
              .items;
            if (Array.isArray(items) && items.length > 0) {
              setGalleryItems(items);
            }
          }
        }
      } catch {
        // Fallback to built-in sample showcase media
      }
    })();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filteredGallery = useMemo(() => {
    if (selectedCategory === "all") return galleryItems;
    return galleryItems.filter((item) => item.category === selectedCategory);
  }, [galleryItems, selectedCategory]);

  return (
    <AppShell>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#0A0A0F] p-6 sm:p-8 lg:p-11">
          <video
            src={heroMedia.heroVideoUrl}
            poster={heroMedia.heroPosterUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, rgba(9,9,13,0.92) 0%, rgba(18,14,38,0.78) 55%, rgba(9,9,13,0.68) 100%)",
            }}
          />

          <div className="relative z-10 max-w-4xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/45 bg-[#7C5CFF]/20 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest text-[#C4B5FD] backdrop-blur-xs">
              <span>✦</span>
              <span>Postoll AI Creative Studio</span>
            </div>

            <h1
              className="font-black tracking-tight text-white"
              style={{
                fontSize: "clamp(2.2rem, 4.6vw, 3.85rem)",
                lineHeight: 1.0,
                letterSpacing: "-0.03em",
              }}
            >
              YOURS TO CREATE &amp; PUBLISH
            </h1>

            <p className="max-w-2xl text-sm font-medium leading-relaxed text-neutral-200 sm:text-base">
              Launch AI workflows, manage your 30-day publishing calendar, and
              connect your social channels from one studio.
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
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/45 bg-amber-500/20 px-5 py-3 text-sm font-extrabold text-amber-100 backdrop-blur-xs transition hover:bg-amber-500/30"
              >
                <span>◫</span>
                <span>Calendar</span>
              </Link>
              <Link
                href="/accounts"
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/45 bg-emerald-500/20 px-5 py-3 text-sm font-extrabold text-emerald-100 backdrop-blur-xs transition hover:bg-emerald-500/30"
              >
                <span>◎</span>
                <span>Accounts</span>
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-2xl border border-pink-400/45 bg-pink-500/20 px-5 py-3 text-sm font-extrabold text-pink-100 backdrop-blur-xs transition hover:bg-pink-500/30"
              >
                <span>✦</span>
                <span>Create Studio</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {TOP_STUDIO_STRIP.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className={`group relative overflow-hidden rounded-2xl border border-white/12 ${card.sizeClass}`}
              >
                <GalleryMedia card={card} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/15" />

                <div className="relative z-10 flex h-full flex-col justify-between p-4 text-white">
                  <span className="w-fit rounded-md bg-black/45 px-2.5 py-0.5 text-[10px] font-black tracking-wider backdrop-blur-xs">
                    {card.badge}
                  </span>
                  <div>
                    <h2 className="text-base font-black tracking-tight">
                      {card.title}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-neutral-200">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_PILLS.map((pill) => {
              const active = selectedCategory === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedCategory(pill.id)}
                  className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
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

        <section className="mt-6">
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGallery.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`group relative overflow-hidden rounded-3xl border border-white/12 ${item.sizeClass}`}
              >
                <GalleryMedia card={item} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />

                <div className="relative z-10 flex h-full flex-col justify-between p-6 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-black uppercase tracking-wider backdrop-blur-xs">
                      {item.badge}
                    </span>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-xs">
                      {item.mediaType === "video" ? "▶ Video" : "✦ Studio"}
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
                    <p className="mt-1.5 text-sm font-medium text-neutral-200">
                      {item.subtitle}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 rounded-xl bg-white/15 px-3.5 py-1.5 text-xs font-extrabold text-white backdrop-blur-xs transition group-hover:bg-[#7C5CFF]">
                      {item.cta} →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_HERO_CONTENT,
  type HeroCmsContent,
  type StatCmsItem,
} from "@/lib/cms-defaults";

type AudienceKey = "creators" | "brands" | "agencies" | "marketers";

const HERO_SAMPLE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const HERO_SAMPLE_POSTER =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80";

const SHOWCASE_CARDS = [
  {
    id: "brand-videos",
    tag: "BRAND VIDEOS",
    title: "Product & Brand Spotlights",
    desc: "Turn ideas or reference visuals into polished commercial clips with rich lighting and motion.",
    mediaType: "video" as const,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    poster:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
    fallback: "from-[#7C5CFF] via-[#9333EA] to-[#EC4899]",
    heightClass: "h-[380px] sm:h-[430px]",
  },
  {
    id: "cinematic-reels",
    tag: "CINEMATIC REELS",
    title: "Multi-Scene Vertical Storytelling",
    desc: "Craft 15s and 30s reels with cohesive scenes, camera rhythm, and captions ready for mobile feeds.",
    mediaType: "video" as const,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4",
    poster:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80",
    fallback: "from-[#0284C7] via-[#4F46E5] to-[#9333EA]",
    heightClass: "h-[320px] sm:h-[360px]",
  },
  {
    id: "automated-posting",
    tag: "AUTOMATED POSTING",
    title: "Touch-Free Daily Workflows",
    desc: "Schedule recurring workflows, pre-generate ahead of time, or auto-publish your own uploaded media.",
    mediaType: "image" as const,
    src: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1000&q=80",
    poster: undefined,
    fallback: "from-[#059669] via-[#0D9488] to-[#2563EB]",
    heightClass: "h-[350px] sm:h-[400px]",
  },
  {
    id: "ai-images",
    tag: "CUSTOM SIZES",
    title: "1:1, 9:16, 16:9 & 4:5 Artwork",
    desc: "Generate instant studio images with optional reference visuals tailored to every social format.",
    mediaType: "image" as const,
    src: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?auto=format&fit=crop&w=1000&q=80",
    poster: undefined,
    fallback: "from-[#D97706] via-[#EA580C] to-[#E11D48]",
    heightClass: "h-[310px] sm:h-[350px]",
  },
];

const AUDIENCE_DETAILS: Record<
  AudienceKey,
  {
    headline: string;
    summary: string;
    points: string[];
    imageUrl: string;
  }
> = {
  creators: {
    headline: "Ship Daily Reels Without Burning Out",
    summary:
      "Go from a raw script or reference photo to ready-to-post visuals and reels in minutes—then queue them on your calendar.",
    points: [
      "Instant Create AI studio for images & multi-scene videos",
      "Pick 9:16 vertical, 16:9 widescreen, 4:5 portrait, or 1:1 square",
      "Keep a steady posting rhythm without manual daily uploads",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1100&q=80",
  },
  brands: {
    headline: "Consistent Brand Look Across Every Channel",
    summary:
      "Keep your visual tone, campaign schedules, and social channels organized in one unified creative workspace.",
    points: [
      "Use reference images to anchor visual style and product identity",
      "Run dedicated workflows for launches, promos, and brand stories",
      "Track scheduled, queued, and published items clearly",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1100&q=80",
  },
  agencies: {
    headline: "Scale Multi-Series Production & Schedules",
    summary:
      "Manage recurring content workflows and multi-channel calendars cleanly so your team focuses on creative direction.",
    points: [
      "Separate automated series workflows from one-off creative tests",
      "30-day visual calendar for clear slot visibility",
      "Predictable credit-based generation and workflow control",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1100&q=80",
  },
  marketers: {
    headline: "Always-On Campaigns That Stay on Schedule",
    summary:
      "Combine AI-generated creatives with your own uploaded campaign assets and automate publishing across social platforms.",
    points: [
      "Support both AI-generated workflows and direct user uploads",
      "Automated pre-generation and scheduled slot execution",
      "Publish across Instagram, Facebook, YouTube, LinkedIn & TikTok",
    ],
    imageUrl:
      "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1100&q=80",
  },
};

function MediaBox({
  mediaType,
  src,
  poster,
  alt,
  fallback,
  className = "",
}: {
  mediaType: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
  fallback: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`h-full w-full bg-gradient-to-br ${fallback} ${className}`}
      />
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${className}`}
    />
  );
}

export default function LandingPage({
  hero,
}: {
  hero?: HeroCmsContent;
  stats?: StatCmsItem[];
}) {
  const supabase = createClient();
  const [audience, setAudience] = useState<AudienceKey>("creators");
  const [heroMedia, setHeroMedia] = useState({
    videoUrl:
      hero?.heroVideoUrl && !hero.heroVideoUrl.includes("mixkit.co")
        ? hero.heroVideoUrl
        : DEFAULT_HERO_CONTENT.heroVideoUrl &&
          !DEFAULT_HERO_CONTENT.heroVideoUrl.includes("mixkit.co")
        ? DEFAULT_HERO_CONTENT.heroVideoUrl
        : HERO_SAMPLE_VIDEO,
    posterUrl:
      hero?.heroPosterUrl ||
      DEFAULT_HERO_CONTENT.heroPosterUrl ||
      HERO_SAMPLE_POSTER,
  });

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
          if (c.heroVideoUrl && !c.heroVideoUrl.includes("mixkit.co")) {
            setHeroMedia((prev) => ({
              videoUrl: c.heroVideoUrl || prev.videoUrl,
              posterUrl: c.heroPosterUrl || prev.posterUrl,
            }));
          }
        }
      } catch {
        // Use default sample media
      }
    })();

    return () => {
      active = false;
    };
  }, [supabase]);

  const activeAudience = AUDIENCE_DETAILS[audience];

  return (
    <div className="min-h-screen bg-[#08080C] text-white selection:bg-[#7C5CFF] selection:text-white">
      {/* TOP NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080C]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-3"
            style={{ color: "#FFFFFF" }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white shadow-md"
              style={{
                background: "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
                color: "#FFFFFF",
              }}
            >
              P
            </span>
            <span className="text-xl font-black tracking-tight text-white">
              Postoll
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-neutral-300 md:flex">
            <a href="#showcase" className="transition hover:text-white">
              AI Showcase
            </a>
            <a href="#automation" className="transition hover:text-white">
              Automated Posting
            </a>
            <a href="#who-its-for" className="transition hover:text-white">
              Creators &amp; Brands
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-extrabold transition hover:bg-white/20"
              style={{ color: "#FFFFFF" }}
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-lg transition hover:opacity-95"
              style={{ background: "#7C5CFF", color: "#FFFFFF" }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* HERO WITH LOOPING AI VIDEO & STUDIO STAGE */}
        <section className="grid items-center gap-10 py-12 lg:grid-cols-12 lg:py-16">
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/45 bg-[#7C5CFF]/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#D8B4FE]">
              <span>✦</span>
              <span>AI Media Studio &amp; Automated Publishing</span>
            </div>

            <h1
              className="font-black uppercase tracking-tight text-white"
              style={{
                fontSize: "clamp(2.5rem, 5.2vw, 4.5rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
              }}
            >
              CREATE,{" "}
              <span className="bg-gradient-to-r from-[#A78BFA] via-[#F472B6] to-[#FB923C] bg-clip-text text-transparent">
                AUTOMATE
              </span>{" "}
              &amp; PUBLISH WITHOUT LIMITS
            </h1>

            <p className="max-w-xl text-base font-medium leading-relaxed text-neutral-300 sm:text-lg">
              Generate high-impact AI videos, reels, and custom-sized images
              on demand—or run hands-free workflows that schedule and publish
              across your social channels.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black shadow-xl transition hover:opacity-95 sm:text-base"
                style={{ background: "#7C5CFF", color: "#FFFFFF" }}
              >
                <span>Start creating free</span>
                <span>→</span>
              </Link>
              <a
                href="#showcase"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 px-6 py-3.5 text-sm font-black shadow-lg transition hover:opacity-90 sm:text-base"
                style={{ background: "#FFFFFF", color: "#09090B" }}
              >
                <span>Explore AI showcase</span>
              </a>
            </div>
          </div>

          {/* LIVE LOOPING VIDEO STAGE */}
          <div className="lg:col-span-6">
            <div className="group relative overflow-hidden rounded-3xl border border-white/15 bg-[#111118] shadow-2xl">
              <div className="aspect-video w-full overflow-hidden">
                <MediaBox
                  mediaType="video"
                  src={heroMedia.videoUrl}
                  poster={heroMedia.posterUrl}
                  alt="Postoll AI Studio Reel Preview"
                  fallback="from-[#4C1D95] via-[#1E1B4B] to-[#831843]"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#12121C] px-5 py-3.5 text-xs font-bold text-neutral-200">
                <span className="inline-flex items-center gap-2 text-[#C4B5FD]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>AI Reels · Custom Sizes · Automated Workflows</span>
                </span>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 font-extrabold text-white">
                  Instant + Scheduled
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* AI SHOWCASE: BRAND VIDEOS, CINEMATIC REELS, AUTOMATION & IMAGES */}
        <section id="showcase" className="py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#F472B6]">
                ✦ What Postoll Creates
              </p>
              <h2
                className="mt-1.5 font-black tracking-tight text-white"
                style={{ fontSize: "clamp(1.85rem, 3.6vw, 3rem)" }}
              >
                BRAND VIDEOS, CINEMATIC REELS &amp; VISUALS
              </h2>
            </div>
            <Link
              href="/login?mode=signup"
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-extrabold transition hover:bg-white/20"
              style={{ color: "#FFFFFF" }}
            >
              Try Create AI →
            </Link>
          </div>

          <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASE_CARDS.map((card) => (
              <div
                key={card.id}
                className={`group relative overflow-hidden rounded-3xl border border-white/12 ${card.heightClass}`}
              >
                <MediaBox
                  mediaType={card.mediaType}
                  src={card.src}
                  poster={card.poster}
                  alt={card.title}
                  fallback={card.fallback}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/15" />
                <div className="relative z-10 flex h-full flex-col justify-between p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-xs">
                      {card.tag}
                    </span>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                      {card.mediaType === "video" ? "▶ Video" : "✦ Image"}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AUTOMATED POSTING & WORKFLOWS SECTION */}
        <section
          id="automation"
          className="my-12 rounded-3xl border border-white/12 bg-gradient-to-br from-[#141224] via-[#0E0E16] to-[#1A1025] p-6 sm:p-10 lg:p-12"
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-6">
              <p className="text-xs font-black uppercase tracking-widest text-[#38BDF8]">
                ◈ Automated Posting Engine
              </p>
              <h2
                className="font-black tracking-tight text-white"
                style={{
                  fontSize: "clamp(1.85rem, 3.5vw, 2.9rem)",
                  lineHeight: 1.05,
                }}
              >
                RUN AUTOMATED WORKFLOWS OR PUBLISH YOUR OWN MEDIA
              </h2>
              <p className="text-base leading-relaxed text-neutral-300">
                Set up automated workflows that generate and queue content for
                recurring slots, or upload your own videos and images and let
                Postoll handle the schedule and publishing.
              </p>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-black text-white">
                    AI Workflow Pipelines
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                    Automated series generation, slot scheduling, and calendar
                    visibility.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-black text-white">
                    Direct Upload Publishing
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                    Upload your own media and publish on time across connected
                    channels.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/login?mode=signup"
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black shadow-lg transition hover:opacity-90"
                  style={{ background: "#FFFFFF", color: "#09090B" }}
                >
                  <span>Launch your workflow</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#09090E] shadow-xl">
                <div className="aspect-[16/10] w-full overflow-hidden">
                  <MediaBox
                    mediaType="image"
                    src="https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&q=80"
                    alt="Automated Social Publishing & Calendar"
                    fallback="from-[#10B981] via-[#2563EB] to-[#7C3AED]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR: CREATORS, BRANDS, AGENCIES, MARKETERS */}
        <section id="who-its-for" className="py-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#C4B5FD]">
                ✦ Built for Every Workflow
              </p>
              <h2
                className="mt-1.5 font-black tracking-tight text-white"
                style={{ fontSize: "clamp(1.85rem, 3.5vw, 2.85rem)" }}
              >
                DESIGNED FOR CREATORS, BRANDS &amp; TEAMS
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["creators", "Creators"],
                  ["brands", "Brands"],
                  ["agencies", "Agencies"],
                  ["marketers", "Marketers"],
                ] as [AudienceKey, string][]
              ).map(([key, label]) => {
                const active = audience === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAudience(key)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${
                      active
                        ? "bg-[#7C5CFF] text-white shadow-md"
                        : "border border-white/15 bg-[#12121A] text-neutral-200 hover:border-white/35 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid items-center gap-8 rounded-3xl border border-white/12 bg-[#101018] p-6 sm:p-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-6">
              <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {activeAudience.headline}
              </h3>
              <p className="text-base leading-relaxed text-neutral-300">
                {activeAudience.summary}
              </p>
              <ul className="space-y-2.5 pt-1 text-sm font-semibold text-neutral-200">
                {activeAudience.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[#C4B5FD]">✦</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/15">
                <MediaBox
                  mediaType="image"
                  src={activeAudience.imageUrl}
                  alt={activeAudience.headline}
                  fallback="from-[#7C5CFF] via-[#EC4899] to-[#F59E0B]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* QUICK FAQ */}
        <section id="faq" className="py-12">
          <h2
            className="mb-6 font-black tracking-tight text-white"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)" }}
          >
            FREQUENTLY ASKED QUESTIONS
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/12 bg-[#111118] p-6">
              <h3 className="text-base font-black text-white">
                Can I generate both AI images and AI videos?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                Yes. Use Create AI to generate images and multi-scene reels in
                multiple sizes (1:1, 9:16, 16:9, 4:5) with optional reference
                images.
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#111118] p-6">
              <h3 className="text-base font-black text-white">
                How does automated posting work?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                Set up workflows and schedule slots so content is prepared and
                published across connected social channels on your timetable.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#07070B] py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 px-4 text-xs font-semibold text-neutral-400 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <p>© {new Date().getFullYear()} Postoll. All rights reserved.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/login?mode=signup" className="hover:text-white">
              Get started
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import type { HeroCmsContent, StatCmsItem } from "@/lib/cms";

type AudienceKey = "creators" | "brands" | "agencies" | "marketers";

const AUDIENCE_DETAILS: Record<
  AudienceKey,
  {
    title: string;
    summary: string;
    highlights: string[];
    badgeColor: string;
  }
> = {
  creators: {
    title: "Built for Solo Creators & Video Makers",
    summary:
      "Turn one idea into short-form reels, eye-catching visuals, and platform-tailored captions without juggling five disconnected tools.",
    highlights: [
      "AI script, storyboard, and reel generation",
      "Recurring posting slots across timezones",
      "Reusable workflows for daily consistency",
    ],
    badgeColor: "#7C5CFF",
  },
  brands: {
    title: "Built for Growing Brands & Product Teams",
    summary:
      "Keep your visual identity, launch calendar, and multi-channel publishing running smoothly every day with predictable credit controls.",
    highlights: [
      "Unified calendar for posts, reels, and images",
      "Approval-ready workflow stages",
      "Direct publishing to connected social channels",
    ],
    badgeColor: "#10B981",
  },
  agencies: {
    title: "Built for Social Agencies & Studio Operators",
    summary:
      "Scale repeatable content pipelines with automated triggers, webhook ingestion, and clean slot-based scheduling.",
    highlights: [
      "Webhook & API key ingestion for automation tools",
      "Pre-generation and scheduled cron dispatch",
      "Centralized visibility into queued and published assets",
    ],
    badgeColor: "#FBBF24",
  },
  marketers: {
    title: "Built for Growth & Performance Marketers",
    summary:
      "Maintain steady organic reach across social feeds with structured cadences, fast creative iteration, and zero manual bottleneck.",
    highlights: [
      "Day-by-day and time-slot scheduling rules",
      "Instant content library filtering and search",
      "Built for fast iteration from draft to publish",
    ],
    badgeColor: "#EC4899",
  },
};

const FEATURE_BLOCKS = [
  {
    eyebrow: "AI CONTENT STUDIO",
    title: "GENERATE POSTS, REELS & VISUALS FASTER",
    description:
      "Start from a prompt or workflow template to create structured scripts, visuals, and ready-to-schedule social assets in one place.",
    accent: "#7C5CFF",
    ctaLabel: "Explore workflows",
    ctaHref: "/workflows",
    metric: "Prompt → Script → Media → Queue",
  },
  {
    eyebrow: "AUTOPILOT SCHEDULER",
    title: "SCHEDULE BY DAY, TIMEZONE & SLOT",
    description:
      "Configure posting days, custom time slots per day, and content-type rules so approved posts and reels claim the next open slot automatically.",
    accent: "#10B981",
    ctaLabel: "See auto-posting",
    ctaHref: "/automatic-posting",
    metric: "Timezone-Aware Slot Engine",
  },
  {
    eyebrow: "MULTI-CHANNEL HUB",
    title: "MANAGE ACCOUNTS & CALENDAR IN ONE VIEW",
    description:
      "Connect social accounts, review upcoming schedules on your calendar, and track every draft, queued item, and published post cleanly.",
    accent: "#EC4899",
    ctaLabel: "Open calendar",
    ctaHref: "/calendar",
    metric: "Unified Publishing Queue",
  },
];

const FAQ_ITEMS = [
  {
    q: "What is Postoll?",
    a: "Postoll is an AI-powered social media content studio and scheduling platform that helps creators, brands, and teams generate posts and reels, organize calendars, and automate publishing.",
  },
  {
    q: "How does automatic scheduling work?",
    a: "You set your preferred timezone, active posting days, and time slots in Settings, then approve content so Postoll schedules items into matching open slots.",
  },
  {
    q: "Does Postoll work smoothly on desktop, tablet, and mobile?",
    a: "Yes. The landing page and workspace use responsive layouts, fluid typography, and lightweight media loading so pages render quickly across screen sizes.",
  },
];

export default function LandingPage({
  hero,
  stats,
}: {
  hero: HeroCmsContent;
  stats: StatCmsItem[];
}) {
  const [audience, setAudience] = useState<AudienceKey>("creators");
  const [samplePrompt, setSamplePrompt] = useState(
    "Launch a 30s vertical reel + caption for our new product drop and queue it for morning peak hours"
  );

  const activeAudience = AUDIENCE_DETAILS[audience];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Postoll",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://postoll.vercel.app",
        description: hero.subheadline,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#7C5CFF] selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C5CFF] text-sm font-black text-white">
              P
            </span>
            <span className="text-lg font-bold tracking-tight">Postoll</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-sm text-neutral-300 md:flex"
          >
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#showcase" className="transition hover:text-white">
              Studio Preview
            </a>
            <a href="#audiences" className="transition hover:text-white">
              Who It&apos;s For
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href={hero.secondaryCtaHref}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/10 sm:text-sm"
            >
              {hero.secondaryCtaText}
            </Link>
            <Link
              href={hero.primaryCtaHref}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-neutral-200 sm:text-sm"
            >
              {hero.primaryCtaText}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, #7C5CFF 0%, #EC4899 55%, transparent 75%)",
            }}
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#C4B5FD]">
                <span className="h-2 w-2 rounded-full bg-[#7C5CFF]" />
                <span>{hero.badge}</span>
              </div>

              <h1
                className="font-black uppercase tracking-tight text-white"
                style={{
                  fontSize: "clamp(2.25rem, 5.2vw, 4.75rem)",
                  lineHeight: 0.98,
                }}
              >
                {hero.headline}
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
                {hero.subheadline}
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  href={hero.primaryCtaHref}
                  className="rounded-full bg-[#7C5CFF] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#6A48F5]"
                >
                  {hero.primaryCtaText} →
                </Link>
                <a
                  href="#showcase"
                  className="rounded-full border border-white/20 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/[0.08]"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Visual Motion / Media Card */}
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#0D0D10] shadow-2xl">
                {hero.heroVideoUrl ? (
                  <video
                    src={hero.heroVideoUrl}
                    poster={hero.heroPosterUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#1B1235] via-[#0D0D12] to-[#1D0F24] p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                      <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1">
                        LIVE STUDIO PIPELINE
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-300">
                        60fps Ready
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-auto py-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm">
                        <div className="h-20 rounded-xl bg-gradient-to-tr from-[#7C5CFF] to-[#38BDF8]" />
                        <p className="mt-2.5 text-xs font-bold">AI Reels</p>
                        <p className="text-[11px] text-neutral-400">Hooks &amp; scenes</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-3 -translate-y-2 shadow-lg">
                        <div className="h-20 rounded-xl bg-gradient-to-tr from-[#EC4899] to-[#FBBF24]" />
                        <p className="mt-2.5 text-xs font-bold">Smart Slots</p>
                        <p className="text-[11px] text-neutral-400">Auto-queue</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm">
                        <div className="h-20 rounded-xl bg-gradient-to-tr from-[#10B981] to-[#6366F1]" />
                        <p className="mt-2.5 text-xs font-bold">Calendar</p>
                        <p className="text-[11px] text-neutral-400">Multi-channel</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-xs">
                      <span className="text-neutral-300">
                        Editable from Admin CMS
                      </span>
                      <span className="font-semibold text-[#C4B5FD]">
                        HD Video &amp; Image Support
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Kinetic Metrics Strip */}
        <section
          aria-label="Platform highlights"
          className="border-b border-white/10 bg-[#08080A] px-4 py-12 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="rounded-2xl border border-white/10 bg-[#0D0D10] p-5"
              >
                <div
                  className="font-black tracking-tight"
                  style={{
                    color: item.color || "#7C5CFF",
                    fontSize: "clamp(2rem, 4vw, 3.25rem)",
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Prompt-to-Schedule Showcase */}
        <section
          id="showcase"
          className="border-b border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#7C5CFF]">
                INTERACTIVE WORKFLOW PREVIEW
              </p>
              <h2
                className="font-black uppercase tracking-tight"
                style={{
                  fontSize: "clamp(1.85rem, 3.8vw, 3.25rem)",
                  lineHeight: 1.04,
                }}
              >
                FROM PROMPT TO SCHEDULED QUEUE IN SECONDS
              </h2>
              <p className="text-sm text-neutral-400 sm:text-base">
                Test a campaign idea below to see how Postoll turns a prompt into a
                structured publishing plan.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-white/15 bg-[#0D0D10] p-5 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={samplePrompt}
                  onChange={(e) => setSamplePrompt(e.target.value)}
                  aria-label="Sample campaign prompt"
                  className="flex-1 rounded-2xl border border-white/15 bg-[#050505] px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:border-[#7C5CFF] focus:outline-none"
                />
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#7C5CFF] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#6A48F5]"
                >
                  ✦ Generate in Postoll
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
                  <span className="text-xs font-bold uppercase text-[#7C5CFF]">
                    01 · Concept &amp; Hook
                  </span>
                  <h3 className="mt-2 text-base font-bold">
                    Hook + Visual Direction
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    &ldquo;{samplePrompt || "Your campaign prompt"}&rdquo; —
                    structured into scroll-stopping scenes and captions.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
                  <span className="text-xs font-bold uppercase text-[#10B981]">
                    02 · Slot Matching
                  </span>
                  <h3 className="mt-2 text-base font-bold">
                    Next Open Posting Slot
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    Matches your active days, timezone, and post/reel rules to keep
                    your publishing queue moving automatically.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#050505] p-5">
                  <span className="text-xs font-bold uppercase text-[#EC4899]">
                    03 · Calendar &amp; Publish
                  </span>
                  <h3 className="mt-2 text-base font-bold">
                    Track Across Channels
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                    Review drafts, approve items, and inspect scheduled or published
                    posts from one unified dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Rows */}
        <section
          id="features"
          className="border-b border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto max-w-7xl space-y-12">
            {FEATURE_BLOCKS.map((block, index) => {
              const reversed = index % 2 === 1;
              return (
                <div
                  key={block.title}
                  className="grid items-center gap-8 rounded-3xl border border-white/10 bg-[#0D0D10] p-6 sm:p-10 lg:grid-cols-12"
                >
                  <div
                    className={`space-y-4 lg:col-span-6 ${
                      reversed ? "lg:order-2" : ""
                    }`}
                  >
                    <p
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: block.accent }}
                    >
                      {block.eyebrow}
                    </p>
                    <h2
                      className="font-black uppercase tracking-tight"
                      style={{
                        fontSize: "clamp(1.75rem, 3.4vw, 2.85rem)",
                        lineHeight: 1.03,
                      }}
                    >
                      {block.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
                      {block.description}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-3">
                      <Link
                        href="/signup"
                        className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition hover:bg-neutral-200 sm:text-sm"
                      >
                        Start now
                      </Link>
                      <Link
                        href={block.ctaHref}
                        className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-white transition hover:border-white/35 sm:text-sm"
                      >
                        {block.ctaLabel}
                      </Link>
                    </div>
                  </div>

                  <div
                    className={`lg:col-span-6 ${
                      reversed ? "lg:order-1" : ""
                    }`}
                  >
                    <div className="flex min-h-[240px] flex-col justify-between rounded-2xl border border-white/10 bg-[#050505] p-6 sm:min-h-[280px]">
                      <div className="flex items-center justify-between">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: block.accent }}
                        />
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-neutral-300">
                          {block.metric}
                        </span>
                      </div>

                      <div className="my-6 space-y-2.5">
                        <div className="h-2.5 w-4/5 rounded-full bg-white/15" />
                        <div className="h-2.5 w-3/5 rounded-full bg-white/10" />
                        <div
                          className="h-16 w-full rounded-xl border border-white/10"
                          style={{
                            background: `linear-gradient(120deg, ${block.accent}28, transparent)`,
                          }}
                        />
                      </div>

                      <p className="text-xs text-neutral-400">
                        Responsive on desktop, tablet, and mobile · Ready for CMS media
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Audience Tabs */}
        <section
          id="audiences"
          className="border-b border-white/10 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <h2
              className="font-black uppercase tracking-tight"
              style={{
                fontSize: "clamp(1.85rem, 3.8vw, 3.25rem)",
                lineHeight: 1.04,
              }}
            >
              BUILT FOR MODERN CREATORS &amp; TEAMS
            </h2>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {(
                [
                  ["creators", "Creators"],
                  ["brands", "Brands"],
                  ["agencies", "Agencies"],
                  ["marketers", "Marketers"],
                ] as const
              ).map(([key, label]) => {
                const active = audience === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAudience(key)}
                    className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-[#7C5CFF] text-white"
                        : "border border-white/15 bg-[#0D0D10] text-neutral-300 hover:border-white/35 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-6 rounded-3xl border border-white/15 bg-[#0D0D10] p-6 sm:p-8 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-7">
                <h3 className="text-2xl font-bold">{activeAudience.title}</h3>
                <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
                  {activeAudience.summary}
                </p>
              </div>
              <div className="lg:col-span-5">
                <ul className="space-y-2.5 rounded-2xl border border-white/10 bg-[#050505] p-5 text-sm">
                  {activeAudience.highlights.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-neutral-200">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: activeAudience.badgeColor }}
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section for AI & Search Engines */}
        <section id="faq" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-black uppercase tracking-tight sm:text-4xl">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <div className="mt-8 space-y-4">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-white/10 bg-[#0D0D10] p-6"
                >
                  <h3 className="text-base font-bold text-white">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070709] px-4 py-10 text-xs text-neutral-400 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Postoll. AI Social Studio &amp; Scheduler.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-white">
              Create account
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/data-deletion" className="hover:text-white">
              Data Deletion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

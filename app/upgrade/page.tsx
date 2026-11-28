"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";
import { PLAN_CONFIGS, getPlanConfig, type PlanTier } from "@/lib/plans";

type PlanMarketingMeta = {
  tagline: string;
  offerBadge: string;
  bonusOffer: string;
  highlight?: boolean;
  ctaLabel: string;
  perks: string[];
};

const PLAN_MARKETING: Record<PlanTier, PlanMarketingMeta> = {
  scheduler: {
    tagline: "Essential autopilot for solo creators & single-brand pages.",
    offerBadge: "Starter Offer \u00B7 25 Free Bonus Credits",
    bonusOffer: "Includes 25 welcome credits + unlimited queued drafts",
    ctaLabel: "Start with Scheduler",
    perks: [
      "1 Active Multi-Platform Workflow (up to 5 social channels)",
      "Instagram, TikTok, YouTube, Facebook & LinkedIn auto-publishing",
      "3 unique media uploads per day with SHA-256 duplicate guard",
      "15 AI Studio & caption generation credits every month",
      "Resend 1-click email approval links & TikTok compliance controls",
      "Recurring weekly schedule slots & timezone autopilot",
    ],
  },
  scheduler_pro: {
    tagline: "Double your brands and daily publishing volume without extra effort.",
    offerBadge: "2x Capacity \u00B7 Best Value for 2 Brands",
    bonusOffer: "2x workflows & 2x daily uploads for just $7 more/mo",
    ctaLabel: "Upgrade to Scheduler Pro",
    perks: [
      "2 Active Multi-Platform Workflows (up to 10 social accounts)",
      "6 unique media uploads per day across your workflows",
      "15 AI Studio & caption generation credits every month",
      "Staggered multi-workflow cron execution (zero rate-limit collisions)",
      "n8n / Zapier ingest webhook API keys included",
      "Priority retry queue & full publish history audit logs",
    ],
  },
  creator: {
    tagline: "Built for daily AI Reels, storyboards & automated video scripts.",
    offerBadge: "AI Powerhouse \u00B7 +133% More AI Credits",
    bonusOffer: "35 monthly AI credits + AI Director daily storyboard engine",
    ctaLabel: "Upgrade to Creator",
    perks: [
      "1 Active Multi-Platform Workflow (up to 5 social channels)",
      "35 AI credits/month for AI Director storyboards, hooks & scripts",
      "Anti-repetition angle memory (never repeats your last 30 hooks)",
      "Locked character & product visual reference consistency",
      "3 unique media uploads per day + 1-click email approval flow",
      "Full access to Create AI Studio & automated reel scheduling",
    ],
  },
  growth: {
    tagline: "Full-scale AI agency & brand growth engine with live analytics.",
    offerBadge: "Most Popular \u00B7 Full Suite + Analytics",
    bonusOffer: "60 AI credits/mo + Cross-Platform Growth Analytics unlocked",
    highlight: true,
    ctaLabel: "Unlock Growth Plan",
    perks: [
      "2 Active Multi-Platform Workflows (up to 10 social accounts)",
      "60 AI credits/month for daily AI reels, carousels & captions",
      "6 unique media uploads per day with SHA-256 deduplication",
      "Cross-Platform Growth Analytics (daily views, reach, likes & shares)",
      "AI Director daily autonomous generation + pre-publish email review",
      "Priority processing, n8n/Zapier webhook API & VIP support",
    ],
  },
};

const COMPARISON_ROWS: Array<{
  feature: string;
  scheduler: string;
  scheduler_pro: string;
  creator: string;
  growth: string;
}> = [
  {
    feature: "Monthly Price",
    scheduler: "$9.99 / mo",
    scheduler_pro: "$16.99 / mo",
    creator: "$24.00 / mo",
    growth: "$39.00 / mo",
  },
  {
    feature: "Active Workflows",
    scheduler: "1 Workflow",
    scheduler_pro: "2 Workflows",
    creator: "1 Workflow",
    growth: "2 Workflows",
  },
  {
    feature: "Connected Social Accounts",
    scheduler: "Up to 5",
    scheduler_pro: "Up to 10",
    creator: "Up to 5",
    growth: "Up to 10",
  },
  {
    feature: "Unique Media Uploads / Day",
    scheduler: "3 / day",
    scheduler_pro: "6 / day",
    creator: "3 / day",
    growth: "6 / day",
  },
  {
    feature: "Monthly AI Credits",
    scheduler: "15 credits",
    scheduler_pro: "15 credits",
    creator: "35 credits",
    growth: "60 credits",
  },
  {
    feature: "AI Director Daily Storyboard Engine",
    scheduler: "Included",
    scheduler_pro: "Included",
    creator: "Full Daily Mode",
    growth: "Full Daily Mode",
  },
  {
    feature: "Resend Email Approvals & TikTok Settings",
    scheduler: "\u2713",
    scheduler_pro: "\u2713",
    creator: "\u2713",
    growth: "\u2713",
  },
  {
    feature: "SHA-256 Duplicate File Protection",
    scheduler: "\u2713",
    scheduler_pro: "\u2713",
    creator: "\u2713",
    growth: "\u2713",
  },
  {
    feature: "n8n / Zapier Webhook Ingest API",
    scheduler: "\u2713",
    scheduler_pro: "\u2713",
    creator: "\u2713",
    growth: "\u2713",
  },
  {
    feature: "Cross-Platform Daily Analytics Dashboard",
    scheduler: "\u2014",
    scheduler_pro: "\u2014",
    creator: "\u2014",
    growth: "\u2713 Full Access",
  },
];

export default function UpgradePage() {
  const supabase = createClient();

  const [currentPlan, setCurrentPlan] = useState<PlanTier>("scheduler");
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<PlanTier | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !active) return;

        const { data: prof } = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", user.id)
          .maybeSingle();

        if (active && prof?.plan_tier) {
          setCurrentPlan(getPlanConfig(prof.plan_tier).id);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleChoosePlan(tier: PlanTier) {
    try {
      setSelecting(tier);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, billingCycle: "monthly" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Unable to start checkout.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Checkout session URL was not returned.");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Unable to start checkout."
      );
      setSelecting(null);
    }
  }

  const orderedTiers: PlanTier[] = [
    "scheduler",
    "scheduler_pro",
    "creator",
    "growth",
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,92,255,0.24) 0%, var(--card) 50%, rgba(236,72,153,0.18) 100%)",
            borderColor: "rgba(124,92,255,0.4)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              {"\u26A1"} Launch Offer {"\u00B7"} Monthly Plans {"\u00B7"} Cancel Anytime
            </span>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3.5 py-1 text-xs font-bold text-emerald-300">
              Current Plan: {PLAN_CONFIGS[currentPlan].name}
            </span>
          </div>

          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Put Your Entire Social Media Engine on Autopilot
          </h1>
          <p
            className="mt-3 max-w-2xl text-sm leading-6 sm:text-base"
            style={{ color: "var(--muted)" }}
          >
            Publish automatically to Instagram, TikTok, YouTube, Facebook, and
            LinkedIn—powered by AI Director storyboards, 1-click email
            approvals, and daily analytics. Flexible monthly billing with zero
            lock-in.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">{"\u2713"}</span> Instant plan activation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">{"\u2713"}</span> Up to 5 platforms per workflow
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">{"\u2713"}</span> Upgrade, downgrade, or cancel anytime
            </span>
          </div>
        </div>

        {successMsg && (
          <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-sm font-medium text-emerald-200">
            {"\uD83C\uDF89"} {successMsg}{" "}
            <Link href="/workflows" className="font-bold underline">
              Go to Workflows {"\u2192"}
            </Link>
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/15 p-4 text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {orderedTiers.map((tier) => {
            const cfg = PLAN_CONFIGS[tier];
            const meta = PLAN_MARKETING[tier];
            const isCurrent = !loading && currentPlan === tier;
            const isFeatured = Boolean(meta.highlight);

            return (
              <div
                key={tier}
                className="relative flex flex-col justify-between rounded-3xl border p-6 transition"
                style={{
                  background: isFeatured
                    ? "linear-gradient(180deg, rgba(124,92,255,0.16) 0%, var(--card) 45%)"
                    : "var(--card)",
                  borderColor: isCurrent
                    ? "#10B981"
                    : isFeatured
                    ? "#7C5CFF"
                    : "var(--border)",
                  boxShadow: isFeatured
                    ? "0 12px 40px -12px rgba(124, 92, 255, 0.35)"
                    : "none",
                }}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                        isFeatured
                          ? "bg-[#7C5CFF] text-white"
                          : "bg-white/10 text-[#C4B5FD]"
                      }`}
                    >
                      {meta.offerBadge}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-black tracking-tight">
                    {cfg.name}
                  </h2>
                  <p
                    className="mt-1.5 min-h-[40px] text-xs leading-5"
                    style={{ color: "var(--muted)" }}
                  >
                    {meta.tagline}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black tracking-tight">
                      ${cfg.monthlyPriceUsd.toFixed(2)}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--muted)" }}
                    >
                      / month
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
                    {"\uD83C\uDF81"} {meta.bonusOffer}
                  </div>

                  <div
                    className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border p-3 text-center"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--background)",
                    }}
                  >
                    <div>
                      <p className="text-base font-black text-white">
                        {cfg.maxWorkflows}
                      </p>
                      <p
                        className="text-[10px] font-semibold uppercase"
                        style={{ color: "var(--muted)" }}
                      >
                        {cfg.maxWorkflows === 1 ? "Workflow" : "Workflows"}
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-black text-white">
                        {cfg.maxManualUploadsPerDay}/d
                      </p>
                      <p
                        className="text-[10px] font-semibold uppercase"
                        style={{ color: "var(--muted)" }}
                      >
                        Uploads
                      </p>
                    </div>
                    <div>
                      <p className="text-base font-black text-[#C4B5FD]">
                        {cfg.monthlyAiCredits}
                      </p>
                      <p
                        className="text-[10px] font-semibold uppercase"
                        style={{ color: "var(--muted)" }}
                      >
                        AI Credits
                      </p>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-xs leading-5">
                    {meta.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5">
                        <span className="mt-0.5 font-bold text-emerald-400">
                          {"\u2713"}
                        </span>
                        <span className="text-neutral-200">{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-2">
                  <button
                    type="button"
                    disabled={isCurrent || Boolean(selecting)}
                    onClick={() => handleChoosePlan(tier)}
                    className={`w-full rounded-2xl px-5 py-3.5 text-sm font-extrabold transition ${
                      isCurrent
                        ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : isFeatured
                        ? "bg-gradient-to-r from-[#7C5CFF] to-[#EC4899] text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                        : "bg-[#7C5CFF] text-white hover:bg-[#6A48F5] disabled:opacity-50"
                    }`}
                  >
                    {isCurrent
                      ? "\u2713 Active Plan"
                      : selecting === tier
                      ? "Activating Plan..."
                      : meta.ctaLabel}
                  </button>
                  <p
                    className="mt-2 text-center text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    Billed monthly {"\u00B7"} Switch or cancel anytime
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <section
          className="mt-12 overflow-hidden rounded-3xl border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="border-b px-6 py-5"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-xl font-black">
              Compare Every Feature Side-by-Side
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Everything included in Postoll across all monthly subscription
              tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead
                className="border-b text-xs uppercase"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--muted)",
                }}
              >
                <tr>
                  <th className="px-6 py-4">Feature</th>
                  <th className="px-4 py-4">Scheduler</th>
                  <th className="px-4 py-4">Scheduler Pro</th>
                  <th className="px-4 py-4">Creator</th>
                  <th className="px-4 py-4 text-[#C4B5FD]">Growth</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-6 py-3.5 font-semibold text-white">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: "var(--muted)" }}>
                      {row.scheduler}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: "var(--muted)" }}>
                      {row.scheduler_pro}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: "var(--muted)" }}>
                      {row.creator}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-300">
                      {row.growth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm font-bold">{"\uD83D\uDD12"} Official Platform OAuth</p>
            <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--muted)" }}>
              Direct Meta, YouTube, TikTok &amp; LinkedIn API integrations with
              token auto-refresh and compliance controls.
            </p>
          </div>
          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm font-bold">{"\u26A1"} Instant Upgrade &amp; Rollover</p>
            <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--muted)" }}>
              Switching plans unlocks extra workflows, daily upload slots, and
              AI credits right away without losing scheduled posts.
            </p>
          </div>
          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <p className="text-sm font-bold">{"\uD83D\uDCB3"} Ready for Stripe / Razorpay</p>
            <p className="mt-1.5 text-xs leading-5" style={{ color: "var(--muted)" }}>
              Need custom enterprise volume or agency seats? Contact support from
              Settings anytime.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

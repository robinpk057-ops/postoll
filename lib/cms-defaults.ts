export type HeroCmsContent = {
  badge: string;
  headline: string;
  subheadline: string;
  primaryCtaText: string;
  primaryCtaHref: string;
  secondaryCtaText: string;
  secondaryCtaHref: string;
  heroVideoUrl: string;
  heroPosterUrl: string;
};

export type StatCmsItem = {
  value: string;
  label: string;
  color: string;
};

export type BannerCmsContent = {
  enabled: boolean;
  message: string;
  ctaText: string;
  ctaHref: string;
};

export const DEFAULT_HERO_CONTENT: HeroCmsContent = {
  badge: "AI-POWERED SOCIAL MEDIA STUDIO",
  headline: "CREATE, AUTOMATE & PUBLISH WITHOUT LIMITS",
  subheadline:
    "Generate scroll-stopping AI reels, images, and captions—then automatically schedule and publish across Instagram, YouTube, TikTok, Facebook, and LinkedIn.",
  primaryCtaText: "Start creating free",
  primaryCtaHref: "/signup",
  secondaryCtaText: "Sign in",
  secondaryCtaHref: "/login",
  heroVideoUrl: "",
  heroPosterUrl: "",
};

export const DEFAULT_STATS_CONTENT: StatCmsItem[] = [
  { value: "6+", label: "SOCIAL PLATFORMS", color: "#7C5CFF" },
  { value: "10X", label: "FASTER CONTENT WORKFLOWS", color: "#FBBF24" },
  { value: "24/7", label: "AUTOPILOT SCHEDULING", color: "#10B981" },
  { value: "100%", label: "AI STORYBOARD TO REEL", color: "#EC4899" },
];

export const DEFAULT_BANNER_CONTENT: BannerCmsContent = {
  enabled: false,
  message:
    "Welcome to Postoll Studio — generate your first AI reel or schedule a post in seconds.",
  ctaText: "Create now",
  ctaHref: "/create",
};

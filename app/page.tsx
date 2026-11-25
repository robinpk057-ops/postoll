import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_HERO_CONTENT,
  DEFAULT_STATS_CONTENT,
  getCmsSections,
  type HeroCmsContent,
  type StatCmsItem,
} from "@/lib/cms";
import LandingPage from "@/app/components/LandingPage";
import ContentLibraryDashboard from "@/app/components/ContentLibraryDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postoll — AI Social Media Studio & Automated Scheduler",
  description:
    "Create AI posts, reels, and visuals—and automate scheduling and publishing across social channels with Postoll.",
  openGraph: {
    title: "Postoll — AI Social Media Studio & Automated Scheduler",
    description:
      "Create AI posts, reels, and visuals—and automate scheduling and publishing across social channels with Postoll.",
    url: "https://postoll.vercel.app",
    siteName: "Postoll",
    type: "website",
  },
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return <ContentLibraryDashboard />;
  }

  const cms = await getCmsSections(["home.hero", "home.stats"]);
  const heroRaw = cms.get("home.hero") || {};
  const statsRaw = cms.get("home.stats") || {};

  const hero: HeroCmsContent = {
    ...DEFAULT_HERO_CONTENT,
    ...(heroRaw as Partial<HeroCmsContent>),
  };

  const stats: StatCmsItem[] = Array.isArray(statsRaw.items)
    ? (statsRaw.items as StatCmsItem[])
    : DEFAULT_STATS_CONTENT;

  return <LandingPage hero={hero} stats={stats} />;
}

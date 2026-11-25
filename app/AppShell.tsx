"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { DEFAULT_BANNER_CONTENT, type BannerCmsContent } from "@/lib/cms-defaults";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [banner, setBanner] = useState<BannerCmsContent>(DEFAULT_BANNER_CONTENT);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/app-banner", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { banner?: BannerCmsContent };
        if (active && data.banner) {
          setBanner({ ...DEFAULT_BANNER_CONTENT, ...data.banner });
        }
      } catch {
        // Non-blocking banner fetch
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {banner.enabled && banner.message && (
          <div className="border-b border-[#7C5CFF]/30 bg-[#7C5CFF]/15 px-4 py-2.5 text-xs text-white sm:px-6 md:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{banner.message}</p>
              {banner.ctaText && banner.ctaHref && (
                <Link
                  href={banner.ctaHref}
                  className="rounded-full bg-[#7C5CFF] px-3.5 py-1 text-xs font-bold text-white transition hover:bg-[#6A48F5]"
                >
                  {banner.ctaText}
                </Link>
              )}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

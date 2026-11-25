"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_BANNER_CONTENT,
  DEFAULT_HERO_CONTENT,
  DEFAULT_STATS_CONTENT,
  type BannerCmsContent,
  type HeroCmsContent,
  type StatCmsItem,
} from "@/lib/cms-defaults";

type SectionRow = {
  section_key: string;
  page_slug: string;
  label: string;
  content: Record<string, unknown>;
  updated_at: string;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [hero, setHero] = useState<HeroCmsContent>(DEFAULT_HERO_CONTENT);
  const [stats, setStats] = useState<StatCmsItem[]>(DEFAULT_STATS_CONTENT);
  const [banner, setBanner] = useState<BannerCmsContent>(DEFAULT_BANNER_CONTENT);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/cms", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Could not load CMS sections");
        }
        const data = (await res.json()) as { sections?: SectionRow[] };
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
  }, []);

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
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setUploadingField(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0D0D10] p-12 text-center text-sm text-neutral-400">
        Loading Admin Control Center...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#7C5CFF]">
            CMS &amp; Security Control
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Landing Page &amp; App Content Editor
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Update public landing page copy, videos, posters, and kinetic stats without altering posting workflows.
          </p>
        </div>
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

      {/* Hero CMS Editor */}
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

      {/* Kinetic Stats Editor */}
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

      {/* Workspace Announcement Banner */}
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
  );
}


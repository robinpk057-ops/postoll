"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "./AppShell";
import { createClient } from "@/lib/supabase/client";

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
      return "bg-purple-500/10 text-purple-400";
    case "scheduled":
    case "queued":
    case "publishing":
      return "bg-blue-500/10 text-blue-400";
    case "published":
      return "bg-green-500/10 text-green-400";
    case "failed":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-gray-500/10 text-gray-300";
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

export default function ContentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        {/* HEADER */}

        <div className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "#a78bfa" }}
              >
                âœ¦ Your content
              </p>

              <h1 className="mt-1 text-3xl font-semibold">
                Content Library
              </h1>

              <p
                className="mt-2 max-w-2xl"
                style={{ color: "var(--muted)" }}
              >
                Manage everything Postoll creates, everything you upload, and
                everything you plan to publish.
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
        </div>

        {/* SUMMARY */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total content", value: String(stats.total) },
            { label: "AI generated", value: String(stats.aiGenerated) },
            { label: "Queued / Scheduled", value: String(stats.scheduled) },
            { label: "Published", value: String(stats.published) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border p-5"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {item.label}
              </p>

              <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        {/* FILTER AREA */}

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
                        ? "rgba(139, 92, 246, 0.10)"
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

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* CONTENT */}

        <div className="mt-6 space-y-4">
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
                âœ¦
              </div>

              <h2 className="mt-5 text-lg font-semibold">No content found</h2>

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
                        "â–¶"
                      ) : item.type === "video" ? (
                        "â—‰"
                      ) : (
                        "âœ¦"
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{item.title}</h2>

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

        {/* FUTURE CONTENT SOURCES */}

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="text-xl">âœ¦</div>
            <h3 className="mt-4 font-semibold">AI Generated</h3>
            <p
              className="mt-2 text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Images, posts and Reels created from your ideas.
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="text-xl">â†‘</div>
            <h3 className="mt-4 font-semibold">Uploaded Content</h3>
            <p
              className="mt-2 text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Upload your own videos and images and let Postoll reuse them.
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="text-xl">â—«</div>
            <h3 className="mt-4 font-semibold">Product Assets</h3>
            <p
              className="mt-2 text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Product images and videos that Postoll can use when creating new
              content.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}


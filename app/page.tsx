"use client";

import { useMemo, useState } from "react";
import AppShell from "./AppShell";

type ContentType =
  | "all"
  | "post"
  | "reel"
  | "image"
  | "video";

type ContentStatus =
  | "all"
  | "draft"
  | "approved"
  | "scheduled"
  | "published";

type ContentItem = {
  id: number;
  title: string;
  type: Exclude<ContentType, "all">;
  status: Exclude<ContentStatus, "all">;
  source: "AI Generated" | "Uploaded";
  platform: string;
  createdAt: string;
  description: string;
};

const demoContent: ContentItem[] = [
  {
    id: 1,
    title: "Save Water",
    type: "post",
    status: "approved",
    source: "AI Generated",
    platform: "Instagram",
    createdAt: "Today",
    description:
      "A social post creative about responsible water usage.",
  },
  {
    id: 2,
    title: "Summer Car Campaign",
    type: "reel",
    status: "draft",
    source: "AI Generated",
    platform: "Instagram",
    createdAt: "Today",
    description:
      "Short-form automotive campaign concept.",
  },
  {
    id: 3,
    title: "Product Demo",
    type: "video",
    status: "scheduled",
    source: "Uploaded",
    platform: "Facebook",
    createdAt: "Yesterday",
    description:
      "Uploaded product video ready for publishing.",
  },
];

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
  { id: "draft", label: "Draft" },
  { id: "approved", label: "Approved" },
  { id: "scheduled", label: "Scheduled" },
  { id: "published", label: "Published" },
];

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

function getStatusClass(status: ContentItem["status"]) {
  switch (status) {
    case "approved":
      return "bg-purple-500/10 text-purple-400";
    case "scheduled":
      return "bg-blue-500/10 text-blue-400";
    case "published":
      return "bg-green-500/10 text-green-400";
    case "draft":
      return "bg-gray-500/10";
  }
}

export default function ContentPage() {
  const [typeFilter, setTypeFilter] =
    useState<ContentType>("all");

  const [statusFilter, setStatusFilter] =
    useState<ContentStatus>("all");

  const [search, setSearch] = useState("");

  const filteredContent = useMemo(() => {
    return demoContent.filter((item) => {
      const matchesType =
        typeFilter === "all" ||
        item.type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      const searchValue = search
        .trim()
        .toLowerCase();

      const matchesSearch =
        !searchValue ||
        item.title
          .toLowerCase()
          .includes(searchValue) ||
        item.description
          .toLowerCase()
          .includes(searchValue);

      return (
        matchesType &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [typeFilter, statusFilter, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">

        {/* HEADER */}

        <div className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-sm font-medium"
                style={{
                  color: "#a78bfa",
                }}
              >
                ✦ Your content
              </p>

              <h1 className="mt-1 text-3xl font-semibold">
                Content Library
              </h1>

              <p
                className="mt-2 max-w-2xl"
                style={{
                  color: "var(--muted)",
                }}
              >
                Manage everything Postoll creates,
                everything you upload, and everything
                you plan to publish.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/create";
              }}
              className="rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{
                background:
                  "var(--foreground)",
                color:
                  "var(--background)",
              }}
            >
              + Create content
            </button>
          </div>
        </div>

        {/* SUMMARY */}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total content",
              value: "3",
            },
            {
              label: "AI generated",
              value: "2",
            },
            {
              label: "Scheduled",
              value: "1",
            },
            {
              label: "Published",
              value: "0",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border p-5"
              style={{
                background: "var(--card)",
                borderColor:
                  "var(--border)",
              }}
            >
              <p
                className="text-sm"
                style={{
                  color: "var(--muted)",
                }}
              >
                {item.label}
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {item.value}
              </p>
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

            {/* SEARCH */}

            <div>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search your content..."
                className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none"
                style={{
                  borderColor:
                    "var(--border)",
                }}
              />
            </div>

            {/* TYPE FILTER */}

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active =
                  typeFilter === filter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      setTypeFilter(
                        filter.id
                      )
                    }
                    className="rounded-full border px-4 py-2 text-sm transition"
                    style={{
                      borderColor: active
                        ? "#8b5cf6"
                        : "var(--border)",
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

            {/* STATUS FILTER */}

            <div className="flex flex-wrap gap-2">
              {statusFilters.map(
                (filter) => {
                  const active =
                    statusFilter ===
                    filter.id;

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() =>
                        setStatusFilter(
                          filter.id
                        )
                      }
                      className="rounded-full border px-4 py-2 text-sm transition"
                      style={{
                        borderColor:
                          active
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
                }
              )}
            </div>
          </div>
        </div>

        {/* CONTENT */}

        <div className="mt-6 space-y-4">
          {filteredContent.length === 0 ? (
            <div
              className="rounded-2xl border p-12 text-center"
              style={{
                background: "var(--card)",
                borderColor:
                  "var(--border)",
              }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-xl">
                ✦
              </div>

              <h2 className="mt-5 text-lg font-semibold">
                No content found
              </h2>

              <p
                className="mx-auto mt-2 max-w-md text-sm"
                style={{
                  color: "var(--muted)",
                }}
              >
                Try changing your filters or
                create something new with
                Postoll.
              </p>
            </div>
          ) : (
            filteredContent.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border p-5 transition hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  borderColor:
                    "var(--border)",
                }}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                  {/* CONTENT INFO */}

                  <div className="flex min-w-0 gap-4">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-xl"
                      style={{
                        borderColor:
                          "var(--border)",
                        background:
                          "var(--card-hover)",
                      }}
                    >
                      {item.type === "reel"
                        ? "▶"
                        : item.type === "video"
                        ? "◉"
                        : "✦"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">
                          {item.title}
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p
                        className="mt-1 text-sm"
                        style={{
                          color:
                            "var(--muted)",
                        }}
                      >
                        {item.description}
                      </p>

                      <div
                        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
                        style={{
                          color:
                            "var(--muted)",
                        }}
                      >
                        <span>
                          {getTypeLabel(
                            item.type
                          )}
                        </span>

                        <span>
                          {item.source}
                        </span>

                        <span>
                          {item.platform}
                        </span>

                        <span>
                          {item.createdAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION */}

                  <button
                    type="button"
                    className="shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      borderColor:
                        "var(--border)",
                    }}
                    onClick={() => {
                      console.log(
                        "Open content:",
                        item
                      );
                    }}
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
              borderColor:
                "var(--border)",
            }}
          >
            <div className="text-xl">
              ✦
            </div>

            <h3 className="mt-4 font-semibold">
              AI Generated
            </h3>

            <p
              className="mt-2 text-sm leading-6"
              style={{
                color: "var(--muted)",
              }}
            >
              Images, posts and Reels created
              from your ideas.
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor:
                "var(--border)",
            }}
          >
            <div className="text-xl">
              ↑
            </div>

            <h3 className="mt-4 font-semibold">
              Uploaded Content
            </h3>

            <p
              className="mt-2 text-sm leading-6"
              style={{
                color: "var(--muted)",
              }}
            >
              Upload your own videos and images
              and let Postoll reuse them.
            </p>
          </div>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor:
                "var(--border)",
            }}
          >
            <div className="text-xl">
              ◫
            </div>

            <h3 className="mt-4 font-semibold">
              Product Assets
            </h3>

            <p
              className="mt-2 text-sm leading-6"
              style={{
                color: "var(--muted)",
              }}
            >
              Product images and videos that
              Postoll can use when creating new
              content.
            </p>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
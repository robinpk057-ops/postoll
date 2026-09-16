"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

import AppShell from "../AppShell";

type ContentItem = {
  id: string;
  user_id: string;

  title: string | null;
  idea: string | null;
  caption: string | null;

  type: string | null;
  status: string | null;

  hashtags: string[] | null;
  image_url: string | null;

  created_at: string;
  updated_at: string;
};

/* -------------------------------------------------------------------------- */
/* IMAGE URL NORMALIZER                                                       */
/* -------------------------------------------------------------------------- */

function normalizeImageUrl(
  imageUrl: string | null
): string | null {
  if (!imageUrl) {
    return null;
  }

  const value = imageUrl.trim();

  if (!value) {
    return null;
  }

  /* Normal remote URL */
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  ) {
    return value;
  }

  /* Already a data URL */
  if (value.startsWith("data:image/")) {
    if (
      value.startsWith("data:image/png;base64,/9j/")
    ) {
      return value.replace(
        "data:image/png;base64,",
        "data:image/jpeg;base64,"
      );
    }

    if (
      value.startsWith("data:image/jpg;base64,/9j/")
    ) {
      return value.replace(
        "data:image/jpg;base64,",
        "data:image/jpeg;base64,"
      );
    }

    return value;
  }

  /* Raw JPEG base64 */
  if (value.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${value}`;
  }

  /* Raw PNG/base64 */
  return `data:image/png;base64,${value}`;
}

/* -------------------------------------------------------------------------- */
/* IMAGE COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

function ContentImage({
  item,
}: {
  item: ContentItem;
}) {
  const [failed, setFailed] = useState(false);

  const imageUrl = normalizeImageUrl(
    item.image_url
  );

  if (!imageUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#171819]">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
            🖼️
          </div>

          <p className="text-sm text-white/40">
            Image unavailable
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={
        item.title ||
        item.idea ||
        "Postoll creative"
      }
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
      onError={() => {
        console.error(
          "Failed to load content image:",
          {
            id: item.id,
            imageUrlStart: imageUrl.substring(
              0,
              100
            ),
          }
        );

        setFailed(true);
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* CONTENT PAGE                                                               */
/* -------------------------------------------------------------------------- */

export default function ContentPage() {
  const supabase = createClient();

  const [content, setContent] =
    useState<ContentItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* LOAD CONTENT                                                             */
  /* ------------------------------------------------------------------------ */

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /* Get authenticated user */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setContent([]);

        setError(
          "Please log in to view your content."
        );

        return;
      }

      /*
       * IMPORTANT:
       *
       * Do NOT load the `plan` column here.
       *
       * Your plan JSON is extremely large and can cause
       * Supabase's statement timeout.
       *
       * The Content page does not need `plan`.
       */

      const {
        data,
        error: contentError,
      } = await supabase
        .from("content")
        .select(
          `
            id,
            user_id,
            title,
            idea,
            caption,
            type,
            status,
            hashtags,
            image_url,
            created_at,
            updated_at
          `
        )
        .eq("user_id", user.id)
        .limit(50);

      if (contentError) {
        throw contentError;
      }

      /*
       * Sort on the client instead of asking Supabase
       * to sort a potentially large table.
       */
      const sortedContent =
        ((data as ContentItem[]) || []).sort(
          (a, b) =>
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
        );

      setContent(sortedContent);
    } catch (err) {
      console.error(
        "Load content error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your content."
      );

      setContent([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  /* ------------------------------------------------------------------------ */
  /* INITIAL LOAD                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  /* ------------------------------------------------------------------------ */
  /* DELETE CONTENT                                                           */
  /* ------------------------------------------------------------------------ */

  async function deleteContent(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this creative?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be logged in."
        );
      }

      const {
        error: deleteError,
      } = await supabase
        .from("content")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setContent((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );
    } catch (err) {
      console.error(
        "Delete content error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this creative."
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* HELPERS                                                                  */
  /* ------------------------------------------------------------------------ */

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(new Date(date));
  }

  function getType(item: ContentItem) {
    return item.type || "post";
  }

  /* ------------------------------------------------------------------------ */
  /* PAGE                                                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell>
      <main className="min-h-screen bg-[#08090a] text-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Content
              </h1>

              <p className="mt-2 text-sm text-white/50">
                Your saved Postoll creatives.
              </p>
            </div>

            <div className="flex items-center gap-3">

              {/* REFRESH */}
              <button
                type="button"
                onClick={loadContent}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              {/* CREATE */}
              <Link
                href="/create"
                className="rounded-xl bg-[#6366f1] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5558e8]"
              >
                Create
              </Link>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="aspect-square animate-pulse bg-white/[0.06]" />

                  <div className="space-y-3 p-5">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-white/[0.06]" />

                    <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />

                    <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMPTY */}
          {!loading &&
            content.length === 0 &&
            !error && (
              <div className="flex min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">

                <div className="max-w-md text-center">

                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                    ✦
                  </div>

                  <h2 className="text-xl font-semibold">
                    No content yet
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Your approved Postoll
                    creatives will appear here.
                  </p>

                  <Link
                    href="/create"
                    className="mt-6 inline-flex rounded-xl bg-[#6366f1] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#5558e8]"
                  >
                    Create your first creative
                  </Link>
                </div>
              </div>
            )}

          {/* CONTENT GRID */}
          {!loading &&
            content.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">

                {content.map((item) => (
                  <article
                    key={item.id}
                    onClick={() => {
                      window.location.href =
                        `/content/${item.id}`;
                    }}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#101112] transition hover:border-white/20 hover:bg-[#121314]"
                  >

                    {/* IMAGE */}
                    <div className="relative aspect-square overflow-hidden bg-[#171819]">

                      <ContentImage
                        item={item}
                      />

                      {/* STATUS */}
                      <div className="absolute left-4 top-4">
                        <span className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-medium capitalize text-white backdrop-blur">
                          {item.status ||
                            "draft"}
                        </span>
                      </div>

                      {/* TYPE */}
                      <div className="absolute right-4 top-4">
                        <span className="rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs font-medium capitalize text-white backdrop-blur">
                          {getType(item)}
                        </span>
                      </div>
                    </div>

                    {/* CONTENT */}
                    <div className="p-5">

                      {/* TITLE */}
                      <div className="mb-3">
                        <h2 className="line-clamp-2 text-lg font-semibold text-white">
                          {item.title ||
                            item.idea ||
                            "Untitled creative"}
                        </h2>
                      </div>

                      {/* IDEA */}
                      {item.idea && (
                        <div className="mb-4">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/30">
                            Idea
                          </p>

                          <p className="line-clamp-3 text-sm leading-6 text-white/60">
                            {item.idea}
                          </p>
                        </div>
                      )}

                      {/* CAPTION */}
                      {item.caption && (
                        <div className="mb-4">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/30">
                            Caption
                          </p>

                          <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-white/60">
                            {item.caption}
                          </p>
                        </div>
                      )}

                      {/* HASHTAGS */}
                      {Array.isArray(
                        item.hashtags
                      ) &&
                        item.hashtags.length >
                          0 && (
                          <div className="mb-5 flex flex-wrap gap-1.5">

                            {item.hashtags
                              .slice(0, 6)
                              .map(
                                (
                                  hashtag,
                                  index
                                ) => (
                                  <span
                                    key={`${hashtag}-${index}`}
                                    className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-white/50"
                                  >
                                    {hashtag.startsWith(
                                      "#"
                                    )
                                      ? hashtag
                                      : `#${hashtag}`}
                                  </span>
                                )
                              )}

                            {item.hashtags.length >
                              6 && (
                              <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-white/30">
                                +
                                {item.hashtags.length -
                                  6}
                              </span>
                            )}
                          </div>
                        )}

                      {/* FOOTER */}
                      <div className="flex items-center justify-between border-t border-white/10 pt-4">

                        <span className="text-xs text-white/30">
                          {formatDate(
                            item.created_at
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();

                            deleteContent(
                              item.id
                            );
                          }}
                          disabled={
                            deletingId ===
                            item.id
                          }
                          className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId ===
                          item.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
        </div>
      </main>
    </AppShell>
  );
}
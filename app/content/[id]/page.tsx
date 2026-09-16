"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ContentItem = {
  id: string;
  user_id: string;

  title: string | null;
  idea: string | null;
  caption: string | null;

  content_type: string | null;
  type: string | null;
  platform: string | null;
  status: string | null;

  concept: string | null;
  creative_intent: string | null;
  image_direction: string | null;

  hashtags: string[] | null;
  image_url: string | null;

  plan: Record<string, unknown> | null;

  scheduled_at: string | null;
  published_at: string | null;
  schedule_status: string | null;

  created_at: string;
  updated_at: string;
};

export default function ContentDetailPage() {
  const params = useParams();
  const router = useRouter();

  const supabase = createClient();

  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [content, setContent] =
    useState<ContentItem | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [showScheduler, setShowScheduler] =
    useState(false);

  const [platform, setPlatform] =
    useState("instagram");

  const [scheduledDate, setScheduledDate] =
    useState("");

  const [scheduledTime, setScheduledTime] =
    useState("");

  const [savingSchedule, setSavingSchedule] =
    useState(false);

  const [scheduleMessage, setScheduleMessage] =
    useState("");

  /*
   * --------------------------------------------------
   * LOAD CONTENT
   * --------------------------------------------------
   */

  const loadContent = useCallback(async () => {
    if (!id) {
      setError("Invalid content ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
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
          "Please log in to view this content."
        );
      }

      const {
        data,
        error: contentError,
      } = await supabase
        .from("content")
        .select(`
          id,
          user_id,
          title,
          idea,
          caption,
          content_type,
          type,
          platform,
          status,
          concept,
          creative_intent,
          image_direction,
          hashtags,
          image_url,
          plan,
          scheduled_at,
          published_at,
          schedule_status,
          created_at,
          updated_at
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (contentError) {
        throw contentError;
      }

      if (!data) {
        throw new Error(
          "This creative could not be found."
        );
      }

      setContent(data as ContentItem);

      /*
       * If already scheduled, preload
       * the scheduler fields.
       */

      if (data.platform) {
        setPlatform(data.platform);
      }

      if (data.scheduled_at) {
        const date = new Date(data.scheduled_at);

        const year = date.getFullYear();

        const month = String(
          date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
          date.getDate()
        ).padStart(2, "0");

        const hours = String(
          date.getHours()
        ).padStart(2, "0");

        const minutes = String(
          date.getMinutes()
        ).padStart(2, "0");

        setScheduledDate(
          `${year}-${month}-${day}`
        );

        setScheduledTime(
          `${hours}:${minutes}`
        );
      }
    } catch (err) {
      console.error(
        "Load content detail error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this content."
      );
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    if (id) {
      loadContent();
    }
  }, [id, loadContent]);

  /*
   * --------------------------------------------------
   * SCHEDULE CONTENT
   * --------------------------------------------------
   */

  async function scheduleContent() {
    setScheduleMessage("");
    setError(null);

    if (!scheduledDate) {
      setError("Please choose a date.");
      return;
    }

    if (!scheduledTime) {
      setError("Please choose a time.");
      return;
    }

    try {
      setSavingSchedule(true);

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

      /*
       * Browser creates the local date/time
       * and converts it to ISO.
       */

      const localDateTime = new Date(
        `${scheduledDate}T${scheduledTime}`
      );

      if (
        Number.isNaN(
          localDateTime.getTime()
        )
      ) {
        throw new Error(
          "Invalid date or time."
        );
      }

      /*
       * Don't allow past schedules.
       */

      if (
        localDateTime.getTime() <=
        Date.now()
      ) {
        throw new Error(
          "Please choose a future date and time."
        );
      }

      const scheduledAt =
        localDateTime.toISOString();

      /*
       * Update existing content.
       */

      const {
        data,
        error: updateError,
      } = await supabase
        .from("content")
        .update({
          platform,
          scheduled_at: scheduledAt,
          schedule_status: "scheduled",
          status: "scheduled",
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setContent(
        data as ContentItem
      );

      setShowScheduler(false);

      setScheduleMessage(
        "Post scheduled successfully."
      );
    } catch (err) {
      console.error(
        "Schedule content error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to schedule this post."
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  /*
   * --------------------------------------------------
   * CANCEL SCHEDULE
   * --------------------------------------------------
   */

  async function cancelSchedule() {
    setError(null);
    setScheduleMessage("");

    try {
      setSavingSchedule(true);

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
        data,
        error: updateError,
      } = await supabase
        .from("content")
        .update({
          scheduled_at: null,
          schedule_status: "draft",
          status: "approved",
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setContent(
        data as ContentItem
      );

      setScheduledDate("");
      setScheduledTime("");

      setScheduleMessage(
        "Schedule cancelled."
      );
    } catch (err) {
      console.error(
        "Cancel schedule error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel the schedule."
      );
    } finally {
      setSavingSchedule(false);
    }
  }

  /*
   * --------------------------------------------------
   * HELPERS
   * --------------------------------------------------
   */

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "Not scheduled";
    }

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

  function getScheduleLabel() {
    if (
      content?.schedule_status ===
      "scheduled"
    ) {
      return "Scheduled";
    }

    if (
      content?.schedule_status ===
      "published"
    ) {
      return "Published";
    }

    return "Not scheduled";
  }

  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090a] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="animate-pulse space-y-6">

            <div className="h-8 w-48 rounded bg-white/10" />

            <div className="h-[500px] rounded-2xl bg-white/5" />

          </div>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * ERROR
   * --------------------------------------------------
   */

  if (error && !content) {
    return (
      <main className="min-h-screen bg-[#08090a] text-white">
        <div className="mx-auto max-w-3xl px-6 py-20">

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">

            <h1 className="text-xl font-semibold text-red-300">
              Unable to load content
            </h1>

            <p className="mt-2 text-sm text-red-200/70">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/content")
              }
              className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Back to Content
            </button>

          </div>

        </div>
      </main>
    );
  }

  if (!content) {
    return null;
  }

  /*
   * --------------------------------------------------
   * MAIN PAGE
   * --------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-[#08090a] text-white">

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* BACK */}

        <button
          type="button"
          onClick={() =>
            router.push("/content")
          }
          className="mb-8 text-sm text-white/50 transition hover:text-white"
        >
          ← Back to Content
        </button>

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>

            <div className="mb-3 flex flex-wrap items-center gap-2">

              {/* CONTENT TYPE */}

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium capitalize text-white/70">
                {content.type ||
                  content.content_type ||
                  "post"}
              </span>

              {/* SCHEDULE STATUS */}

              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  content.schedule_status ===
                  "scheduled"
                    ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                    : content.schedule_status ===
                        "published"
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-white/10 bg-white/[0.04] text-white/50"
                }`}
              >
                {getScheduleLabel()}
              </span>

            </div>

            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {content.title ||
                content.idea ||
                "Untitled creative"}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
              {content.concept ||
                content.idea ||
                "Your Postoll creative."}
            </p>

          </div>

          {/* SCHEDULE BUTTON */}

          {content.schedule_status !==
            "published" && (
            <button
              type="button"
              onClick={() =>
                setShowScheduler(
                  !showScheduler
                )
              }
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              {content.schedule_status ===
              "scheduled"
                ? "Edit Schedule"
                : "Schedule Post"}
            </button>
          )}

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {scheduleMessage && (
          <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {scheduleMessage}
          </div>
        )}

        {/* ================================================== */}
        {/* SCHEDULER */}
        {/* ================================================== */}

        {showScheduler && (
          <section className="mb-8 rounded-2xl border border-white/10 bg-[#101112] p-6">

            <div className="mb-6">

              <p className="text-sm font-medium text-purple-400">
                Postoll Scheduler
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Schedule this creative
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                Choose where and when Postoll should
                publish this creative. For now, this
                only saves the schedule to your database.
              </p>

            </div>

            <div className="grid gap-5 md:grid-cols-3">

              {/* PLATFORM */}

              <div>

                <label className="mb-2 block text-sm font-medium text-white/70">
                  Platform
                </label>

                <select
                  value={platform}
                  onChange={(event) =>
                    setPlatform(
                      event.target.value
                    )
                  }
                  disabled={savingSchedule}
                  className="w-full rounded-xl border border-white/10 bg-[#08090a] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                >
                  <option value="instagram">
                    Instagram
                  </option>

                  <option value="facebook">
                    Facebook
                  </option>

                  <option value="linkedin">
                    LinkedIn
                  </option>

                  <option value="x">
                    X / Twitter
                  </option>
                </select>

              </div>

              {/* DATE */}

              <div>

                <label className="mb-2 block text-sm font-medium text-white/70">
                  Date
                </label>

                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) =>
                    setScheduledDate(
                      event.target.value
                    )
                  }
                  disabled={savingSchedule}
                  min={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#08090a] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                />

              </div>

              {/* TIME */}

              <div>

                <label className="mb-2 block text-sm font-medium text-white/70">
                  Time
                </label>

                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) =>
                    setScheduledTime(
                      event.target.value
                    )
                  }
                  disabled={savingSchedule}
                  className="w-full rounded-xl border border-white/10 bg-[#08090a] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
                />

              </div>

            </div>

            {/* PREVIEW */}

            {scheduledDate &&
              scheduledTime && (
                <div className="mt-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">

                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Scheduled for
                  </p>

                  <p className="mt-1 text-sm font-medium text-white">
                    {new Intl.DateTimeFormat(
                      "en-IN",
                      {
                        dateStyle: "full",
                        timeStyle: "short",
                      }
                    ).format(
                      new Date(
                        `${scheduledDate}T${scheduledTime}`
                      )
                    )}
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    Platform:{" "}
                    <span className="capitalize">
                      {platform}
                    </span>
                  </p>

                </div>
              )}

            {/* ACTIONS */}

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">

              {content.schedule_status ===
                "scheduled" && (
                <button
                  type="button"
                  onClick={cancelSchedule}
                  disabled={savingSchedule}
                  className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Cancel Schedule
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setShowScheduler(false)
                }
                disabled={savingSchedule}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={scheduleContent}
                disabled={savingSchedule}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSchedule
                  ? "Saving..."
                  : "Schedule Post"}
              </button>

            </div>

          </section>
        )}

        {/* ================================================== */}
        {/* SCHEDULE STATUS */}
        {/* ================================================== */}

        {content.schedule_status ===
          "scheduled" && (
          <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10 text-purple-400">
                    ✓
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-purple-300">
                      Scheduled
                    </p>

                    <p className="text-xs text-white/40">
                      {content.platform
                        ? content.platform
                        : "Platform not selected"}
                    </p>

                  </div>

                </div>

              </div>

              <div className="text-left md:text-right">

                <p className="text-xs uppercase tracking-wide text-white/30">
                  Publish time
                </p>

                <p className="mt-1 text-sm font-medium">
                  {formatDate(
                    content.scheduled_at
                  )}
                </p>

              </div>

            </div>

          </section>
        )}

        {/* ================================================== */}
        {/* MAIN CONTENT */}
        {/* ================================================== */}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">

          {/* IMAGE */}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101112]">

            <div className="border-b border-white/10 px-5 py-4">

              <h2 className="text-sm font-semibold">
                Creative
              </h2>

            </div>

            <div className="flex min-h-[500px] items-center justify-center bg-black p-5">

              {content.image_url ? (
                <img
                  src={content.image_url}
                  alt={
                    content.title ||
                    "Postoll creative"
                  }
                  className="max-h-[750px] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="text-sm text-white/30">
                  No image available
                </div>
              )}

            </div>

          </div>

          {/* DETAILS */}

          <div className="space-y-6">

            {/* CAPTION */}

            {content.caption && (
              <section className="rounded-2xl border border-white/10 bg-[#101112] p-5">

                <h2 className="text-sm font-semibold">
                  Caption
                </h2>

                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/60">
                  {content.caption}
                </p>

              </section>
            )}

            {/* HASHTAGS */}

            {content.hashtags &&
              content.hashtags.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-[#101112] p-5">

                  <h2 className="text-sm font-semibold">
                    Hashtags
                  </h2>

                  <div className="mt-4 flex flex-wrap gap-2">

                    {content.hashtags.map(
                      (
                        hashtag,
                        index
                      ) => (
                        <span
                          key={`${hashtag}-${index}`}
                          className="rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-white/50"
                        >
                          {hashtag.startsWith(
                            "#"
                          )
                            ? hashtag
                            : `#${hashtag}`}
                        </span>
                      )
                    )}

                  </div>

                </section>
              )}

            {/* CREATIVE INFO */}

            <section className="rounded-2xl border border-white/10 bg-[#101112] p-5">

              <h2 className="text-sm font-semibold">
                Creative details
              </h2>

              <div className="mt-4 space-y-4">

                {content.idea && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Idea
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {content.idea}
                    </p>

                  </div>
                )}

                {content.concept && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Concept
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {content.concept}
                    </p>

                  </div>
                )}

                {content.creative_intent && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Creative intent
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {content.creative_intent}
                    </p>

                  </div>
                )}

                {content.image_direction && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Image direction
                    </p>

                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {content.image_direction}
                    </p>

                  </div>
                )}

                {content.platform && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Platform
                    </p>

                    <p className="mt-1 text-sm capitalize text-white/60">
                      {content.platform}
                    </p>

                  </div>
                )}

                {content.status && (
                  <div>

                    <p className="text-xs uppercase tracking-wide text-white/30">
                      Status
                    </p>

                    <p className="mt-1 text-sm capitalize text-white/60">
                      {content.status}
                    </p>

                  </div>
                )}

                <div>

                  <p className="text-xs uppercase tracking-wide text-white/30">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-white/60">
                    {formatDate(
                      content.created_at
                    )}
                  </p>

                </div>

              </div>

            </section>

            {/* CREATE ANOTHER */}

            <button
              type="button"
              onClick={() =>
                router.push("/create")
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Create another creative
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}
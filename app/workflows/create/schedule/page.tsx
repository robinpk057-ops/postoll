"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppShell from "../../../AppShell";
import {
  useWorkflow,
  type ScheduleSlot,
} from "../context";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const durations = [
  {
    value: "1_month",
    label: "1 Month",
  },
  {
    value: "3_months",
    label: "3 Months",
  },
  {
    value: "6_months",
    label: "6 Months",
  },
  {
    value: "12_months",
    label: "12 Months",
  },
  {
    value: "unlimited",
    label: "Unlimited",
  },
  {
    value: "custom",
    label: "Custom Date Range",
  },
];

function createTimes(count: number, start: number) {
  const times: string[] = [];

  for (let i = 0; i < count; i++) {
    const hour = (start + i * 3) % 24;

    times.push(
      `${String(hour).padStart(2, "0")}:00`
    );
  }

  return times;
}

function formatTime(time: string) {
  if (!time) {
    return "";
  }

  const [hour, minute] = time.split(":");

  const h = Number(hour);

  const period = h >= 12 ? "PM" : "AM";

  const displayHour =
    h % 12 === 0
      ? 12
      : h % 12;

  return `${String(displayHour).padStart(
    2,
    "0"
  )}:${minute} ${period}`;
}

export default function SchedulePage() {
  const router = useRouter();

  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();

  /*
   * ---------------------------------------------------------
   * USER UPLOAD WORKFLOW
   * ---------------------------------------------------------
   *
   * One uploaded content item = one publishing slot.
   *
   * Example:
   *
   * Content Per Day = 3
   *
   * Content 1 -> 09:00 AM
   * Content 2 -> 12:00 PM
   * Content 3 -> 03:00 PM
   *
   * No Reel/Post distinction.
   */

  function generateUploadedContentSlots(
    count: number
  ) {
    if (count < 1) {
      count = 1;
    }

    const times = createTimes(
      count,
      9
    );

    const slots: ScheduleSlot[] = [];

    for (
      let i = 1;
      i <= count;
      i++
    ) {
      slots.push({
        type: "content",
        number: i,
        time: times[i - 1],
      });
    }

    updateWorkflow({
      scheduleSlots: slots,
      scheduleTimes: slots.map(
        (item) => item.time
      ),
    });
  }

  /*
   * ---------------------------------------------------------
   * AI / POSTOLL CREATED WORKFLOW
   * ---------------------------------------------------------
   *
   * Existing Reel + Post scheduling remains unchanged.
   */

  function generateSlots(
    reels: number,
    posts: number
  ) {
    if (reels < 1) {
      reels = 1;
    }

    if (posts < 1) {
      posts = 1;
    }

    const slots: any[] = [];

    const reelTimes = createTimes(
      reels,
      9
    );

    const postTimes = createTimes(
      posts,
      18
    );

    for (
      let i = 1;
      i <= reels;
      i++
    ) {
      slots.push({
        type: "reel",
        number: i,
        time: reelTimes[i - 1],
      });
    }

    for (
      let i = 1;
      i <= posts;
      i++
    ) {
      slots.push({
        type: "post",
        number: i,
        time: postTimes[i - 1],
      });
    }

    updateWorkflow({
      reelsPerDay: reels,
      postsPerDay: posts,

      scheduleSlots: slots,

      scheduleTimes: slots.map(
        (item) => item.time
      ),
    });
  }

  /*
   * ---------------------------------------------------------
   * INITIAL SCHEDULE SETUP
   * ---------------------------------------------------------
   *
   * Important:
   *
   * user_uploaded
   *     -> Content 1, Content 2, Content 3...
   *
   * ai_generated
   *     -> Reel 1, Reel 2...
   *        Post 1, Post 2...
   */

  useEffect(() => {
    if (
      workflow.scheduleSlots.length === 0
    ) {
      if (
        workflow.source ===
        "user_uploaded"
      ) {
        generateUploadedContentSlots(1);
      } else {
        generateSlots(
          workflow.reelsPerDay || 1,
          workflow.postsPerDay || 1
        );
      }
    }

    // Initial setup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ---------------------------------------------------------
   * POSTING DAYS
   * ---------------------------------------------------------
   */

  function toggleDay(
    day: string
  ) {
    const current =
      workflow.scheduleDays || [];

    updateWorkflow({
      scheduleDays:
        current.includes(day)
          ? current.filter(
              (item) => item !== day
            )
          : [
              ...current,
              day,
            ],
    });
  }

  /*
   * ---------------------------------------------------------
   * UPDATE INDIVIDUAL TIME
   * ---------------------------------------------------------
   */

  function updateSlotTime(
    index: number,
    time: string
  ) {
    const updated = [
      ...workflow.scheduleSlots,
    ];

    updated[index] = {
      ...updated[index],
      time,
    };

    updateWorkflow({
      scheduleSlots: updated,

      scheduleTimes: updated.map(
        (item) => item.time
      ),
    });
  }

  /*
   * ---------------------------------------------------------
   * CONTINUE
   * ---------------------------------------------------------
   */

  function continueNext() {
    if (
      workflow.scheduleSlots.length === 0
    ) {
      return;
    }

    if (
      workflow.scheduleDays.length === 0
    ) {
      return;
    }

    router.push(
      "/workflows/create/accounts"
    );
  }

  /*
   * ---------------------------------------------------------
   * CURRENT UPLOADED CONTENT COUNT
   * ---------------------------------------------------------
   *
   * We derive this from scheduleSlots instead of requiring
   * a new contentPerDay field in context.tsx.
   */

  const uploadedContentCount =
    workflow.scheduleSlots.filter(
      (slot) =>
        slot.type === "content"
    ).length || 1;

  return (
    <AppShell>

      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">

        {/* HEADER */}

        <div className="mb-10">

          <p
            className="text-sm font-medium"
            style={{
              color: "#a78bfa",
            }}
          >
            ✦ Scheduling Setup
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            When should Postoll publish?
          </h1>

          <p
            className="mt-3 text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            Choose frequency and timing for your
            automatic content.
          </p>

        </div>


        {/* MAIN CARD */}

        <div
          className="space-y-10 rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >

          {/* =================================================
              CONTENT PER DAY
              ================================================= */}

          <div>

            <h2 className="text-xl font-semibold">
              Content Per Day
            </h2>


            {workflow.source ===
            "user_uploaded" ? (

              /*
               * ------------------------------------------------
               * USER UPLOAD
               * ------------------------------------------------
               */

              <div className="mt-6">

                <p
                  className="text-sm"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  How many pieces of content do you
                  want to publish per day?
                </p>


                <div className="mt-4 flex gap-3">

                  {[1, 2, 3].map(
                    (num) => (

                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          generateUploadedContentSlots(
                            num
                          )
                        }
                        className="rounded-xl border px-6 py-3 transition"
                        style={{
                          background:
                            uploadedContentCount ===
                            num
                              ? "rgba(139,92,246,.15)"
                              : "var(--background)",

                          borderColor:
                            uploadedContentCount ===
                            num
                              ? "#8b5cf6"
                              : "var(--border)",
                        }}
                      >
                        {num}
                      </button>

                    )
                  )}

                </div>

              </div>

            ) : (

              /*
               * ------------------------------------------------
               * POSTOLL CREATES CONTENT
               * ------------------------------------------------
               */

              <div className="mt-6 grid gap-8 md:grid-cols-2">

                {/* REELS */}

                <div>

                  <p className="text-sm">
                    Reels per day
                  </p>

                  <div className="mt-3 flex gap-3">

                    {[1, 2, 3].map(
                      (num) => (

                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            generateSlots(
                              num,
                              workflow.postsPerDay ||
                                1
                            )
                          }
                          className="rounded-xl border px-6 py-3 transition"
                          style={{
                            background:
                              workflow.reelsPerDay ===
                              num
                                ? "rgba(139,92,246,.15)"
                                : "var(--background)",

                            borderColor:
                              workflow.reelsPerDay ===
                              num
                                ? "#8b5cf6"
                                : "var(--border)",
                          }}
                        >
                          {num}
                        </button>

                      )
                    )}

                  </div>

                </div>


                {/* POSTS */}

                <div>

                  <p className="text-sm">
                    Posts per day
                  </p>

                  <div className="mt-3 flex gap-3">

                    {[1, 2, 3].map(
                      (num) => (

                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            generateSlots(
                              workflow.reelsPerDay ||
                                1,
                              num
                            )
                          }
                          className="rounded-xl border px-6 py-3 transition"
                          style={{
                            background:
                              workflow.postsPerDay ===
                              num
                                ? "rgba(139,92,246,.15)"
                                : "var(--background)",

                            borderColor:
                              workflow.postsPerDay ===
                              num
                                ? "#8b5cf6"
                                : "var(--border)",
                          }}
                        >
                          {num}
                        </button>

                      )
                    )}

                  </div>

                </div>

              </div>

            )}

          </div>


          {/* =================================================
              POSTING DAYS
              ================================================= */}

          <div>

            <h2 className="text-xl font-semibold">
              Posting Days
            </h2>

            <p
              className="mt-2 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Select the days when Postoll should
              publish your content.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">

              {days.map(
                (day) => (

                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      toggleDay(day)
                    }
                    className="rounded-full border px-5 py-2 text-sm transition"
                    style={{
                      background:
                        workflow.scheduleDays.includes(
                          day
                        )
                          ? "rgba(139,92,246,.15)"
                          : "var(--background)",

                      borderColor:
                        workflow.scheduleDays.includes(
                          day
                        )
                          ? "#8b5cf6"
                          : "var(--border)",
                    }}
                  >
                    {day.substring(0, 3)}
                  </button>

                )
              )}

            </div>

          </div>


          {/* =================================================
              POSTING TIMES
              ================================================= */}

          <div>

            <h2 className="text-xl font-semibold">
              Posting Times
            </h2>

            <p
              className="mt-2 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              These times will automatically apply
              to all selected days.
            </p>


            <div className="mt-5 space-y-4">

              {workflow.scheduleSlots.map(
                (slot, index) => (

                  <div
                    key={`${slot.type}-${slot.number}`}
                    className="flex items-center justify-between rounded-xl border p-4"
                    style={{
                      borderColor:
                        "var(--border)",
                    }}
                  >

                    {/* SLOT NAME */}

                    <div>

                      <p className="font-medium">

                        {slot.type ===
                        "content"
                          ? `Content ${slot.number}`
                          : slot.type ===
                            "reel"
                          ? `Reel ${slot.number}`
                          : `Post ${slot.number}`}

                      </p>

                      {workflow.source ===
                        "user_uploaded" && (
                        <p
                          className="mt-1 text-xs"
                          style={{
                            color:
                              "var(--muted)",
                          }}
                        >
                          Uploaded content
                        </p>
                      )}

                    </div>


                    {/* TIME */}

                    <div className="flex items-center gap-3">

                      <span
                        className="text-sm"
                        style={{
                          color:
                            "var(--muted)",
                        }}
                      >
                        {formatTime(
                          slot.time
                        )}
                      </span>


                      <TimePicker
                        value={slot.time}
                        onChange={(time) =>
                          updateSlotTime(
                            index,
                            time
                          )
                        }
                      />

                    </div>

                  </div>

                )
              )}

            </div>

          </div>


          {/* =================================================
              SCHEDULE DURATION
              ================================================= */}

          <div>

            <h2 className="text-xl font-semibold">
              Schedule Duration
            </h2>

            <p
              className="mt-2 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Choose how long this workflow should
              continue publishing.
            </p>


            <div className="mt-4 grid gap-3 md:grid-cols-3">

              {durations.map(
                (item) => (

                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      updateWorkflow({
                        scheduleDuration:
                          item.value,
                      })
                    }
                    className="rounded-xl border p-4 transition"
                    style={{
                      background:
                        workflow.scheduleDuration ===
                        item.value
                          ? "rgba(139,92,246,.15)"
                          : "var(--background)",

                      borderColor:
                        workflow.scheduleDuration ===
                        item.value
                          ? "#8b5cf6"
                          : "var(--border)",
                    }}
                  >
                    {item.label}
                  </button>

                )
              )}

            </div>

          </div>


          {/* =================================================
              CUSTOM DATE RANGE
              ================================================= */}

          {workflow.scheduleDuration ===
            "custom" && (

            <div className="grid gap-4 md:grid-cols-2">

              {/* START DATE */}

              <div>

                <label
                  className="mb-2 block text-sm"
                >
                  Start Date
                </label>

                <input
                  type="date"
                  value={
                    workflow.customStartDate
                  }
                  onChange={(e) =>
                    updateWorkflow({
                      customStartDate:
                        e.target.value,
                    })
                  }
                  className="w-full rounded-xl border p-3"
                  style={{
                    background:
                      "var(--background)",
                    borderColor:
                      "var(--border)",
                  }}
                />

              </div>


              {/* END DATE */}

              <div>

                <label
                  className="mb-2 block text-sm"
                >
                  End Date
                </label>

                <input
                  type="date"
                  value={
                    workflow.customEndDate
                  }
                  onChange={(e) =>
                    updateWorkflow({
                      customEndDate:
                        e.target.value,
                    })
                  }
                  className="w-full rounded-xl border p-3"
                  style={{
                    background:
                      "var(--background)",
                    borderColor:
                      "var(--border)",
                  }}
                />

              </div>

            </div>

          )}


          {/* =================================================
              BUTTONS
              ================================================= */}

          <div
            className="flex justify-between border-t pt-6"
            style={{
              borderColor:
                "var(--border)",
            }}
          >

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="rounded-xl border px-6 py-3 transition hover:bg-white/5"
              style={{
                borderColor:
                  "var(--border)",
              }}
            >
              ← Back
            </button>


            <button
              type="button"
              disabled={
                workflow.scheduleSlots
                  .length === 0 ||
                workflow.scheduleDays
                  .length === 0
              }
              onClick={continueNext}
              className="rounded-xl px-6 py-3 font-semibold transition disabled:opacity-40"
              style={{
                background:
                  "var(--foreground)",
                color:
                  "var(--background)",
              }}
            >
              Continue →
            </button>

          </div>

        </div>

      </div>

    </AppShell>
  );
}


/*
|--------------------------------------------------------------------------
| TIME PICKER
|--------------------------------------------------------------------------
|
| Allows the user to select:
|
|   Hour   -> 1 to 12
|   Minute -> 00 to 59
|   Period -> AM / PM
|
| The value stored in workflow remains HH:mm.
|
|--------------------------------------------------------------------------
*/

function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {

  const [
    hourString,
    minuteString,
  ] = (value || "09:00").split(":");

  const currentHour =
    Number(hourString) || 9;

  const currentMinute =
    Number(minuteString) || 0;

  const currentPeriod =
    currentHour >= 12
      ? "PM"
      : "AM";

  const displayHour =
    currentHour % 12 === 0
      ? 12
      : currentHour % 12;


  function updateTime(
    hour: number,
    minute: number,
    period: string
  ) {

    let hour24 = hour;

    if (period === "AM") {

      if (hour === 12) {
        hour24 = 0;
      }

    } else {

      if (hour !== 12) {
        hour24 = hour + 12;
      }

    }

    const formatted =
      `${String(hour24).padStart(
        2,
        "0"
      )}:${String(minute).padStart(
        2,
        "0"
      )}`;

    onChange(formatted);
  }


  return (

    <div className="flex items-center gap-2">

      {/* HOUR */}

      <select
        value={displayHour}
        onChange={(e) =>
          updateTime(
            Number(e.target.value),
            currentMinute,
            currentPeriod
          )
        }
        className="rounded-lg border px-3 py-2"
        style={{
          background:
            "var(--background)",
          borderColor:
            "var(--border)",
        }}
      >

        {Array.from(
          {
            length: 12,
          },
          (_, i) => i + 1
        ).map(
          (hour) => (

            <option
              key={hour}
              value={hour}
            >
              {String(hour).padStart(
                2,
                "0"
              )}
            </option>

          )
        )}

      </select>


      <span className="font-medium">
        :
      </span>


      {/* MINUTE */}

      <select
        value={currentMinute}
        onChange={(e) =>
          updateTime(
            displayHour,
            Number(e.target.value),
            currentPeriod
          )
        }
        className="rounded-lg border px-3 py-2"
        style={{
          background:
            "var(--background)",
          borderColor:
            "var(--border)",
        }}
      >

        {Array.from(
          {
            length: 60,
          },
          (_, i) => i
        ).map(
          (minute) => (

            <option
              key={minute}
              value={minute}
            >
              {String(minute).padStart(
                2,
                "0"
              )}
            </option>

          )
        )}

      </select>


      {/* AM / PM */}

      <select
        value={currentPeriod}
        onChange={(e) =>
          updateTime(
            displayHour,
            currentMinute,
            e.target.value
          )
        }
        className="rounded-lg border px-3 py-2"
        style={{
          background:
            "var(--background)",
          borderColor:
            "var(--border)",
        }}
      >

        <option value="AM">
          AM
        </option>

        <option value="PM">
          PM
        </option>

      </select>

    </div>

  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";
import { createClient } from "@/lib/supabase/client";

type DatabaseSource = "ai_generated" | "user_uploaded";

export default function ReviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const { workflow } = useWorkflow();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | NORMALIZE SOURCE
  |--------------------------------------------------------------------------
  |
  | Database allows only:
  |
  | ai_generated
  | user_uploaded
  |
  */

  function getDatabaseSource(): DatabaseSource | null {
    const rawSource = String(workflow?.source ?? "")
      .trim()
      .toLowerCase();

    if (
      rawSource === "ai" ||
      rawSource === "ai-generated" ||
      rawSource === "ai_generated" ||
      rawSource === "aigenerated"
    ) {
      return "ai_generated";
    }

    if (
      rawSource === "uploaded" ||
      rawSource === "user-uploaded" ||
      rawSource === "user_uploaded" ||
      rawSource === "useruploaded"
    ) {
      return "user_uploaded";
    }

    /*
     * If files were uploaded, this is definitely
     * user-uploaded content.
     */
    if (
      workflow?.uploadFiles &&
      workflow.uploadFiles.length > 0
    ) {
      return "user_uploaded";
    }

    /*
     * If the workflow contains AI content information,
     * treat it as AI-generated.
     */
    if (
      workflow?.contentDescription ||
      workflow?.reelScript ||
      workflow?.postScript
    ) {
      return "ai_generated";
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | CONTENT TYPE
  |--------------------------------------------------------------------------
  */

  function getContentType(): string {
    const formats = workflow?.formats ?? [];

    if (formats.length === 0) {
      return "reel";
    }

    const normalized = formats.map((item: string) =>
      String(item).trim().toLowerCase()
    );

    const hasReel =
      normalized.includes("reel") ||
      normalized.includes("reels") ||
      normalized.includes("video");

    const hasPost =
      normalized.includes("post") ||
      normalized.includes("posts") ||
      normalized.includes("image");

    if (hasReel && hasPost) {
      return "both";
    }

    if (hasReel) {
      return "reel";
    }

    if (hasPost) {
      return "post";
    }

    return normalized[0] || "reel";
  }

  /*
  |--------------------------------------------------------------------------
  | POSTS PER DAY
  |--------------------------------------------------------------------------
  |
  | Database currently has only:
  |
  | posts_per_day
  |
  | It does NOT have:
  |
  | reels_per_day
  |
  */

  function getPostsPerDay(): number {
    const reelsPerDay = Number(
      workflow?.reelsPerDay ?? 0
    );

    const postsPerDay = Number(
      workflow?.postsPerDay ?? 0
    );

    const contentType = getContentType();

    if (contentType === "reel") {
      return Number.isFinite(reelsPerDay)
        ? reelsPerDay
        : 0;
    }

    if (contentType === "post") {
      return Number.isFinite(postsPerDay)
        ? postsPerDay
        : 0;
    }

    if (contentType === "both") {
      return (
        (Number.isFinite(reelsPerDay)
          ? reelsPerDay
          : 0) +
        (Number.isFinite(postsPerDay)
          ? postsPerDay
          : 0)
      );
    }

    return Number.isFinite(postsPerDay)
      ? postsPerDay
      : 0;
  }

  /*
  |--------------------------------------------------------------------------
  | DURATION
  |--------------------------------------------------------------------------
  */

  function getDurationType(): string {
    return workflow?.scheduleDuration || "unlimited";
  }

  /*
  |--------------------------------------------------------------------------
  | START DATE
  |--------------------------------------------------------------------------
  */

  function getStartDate(): string | null {
    if (!workflow?.customStartDate) {
      return null;
    }

    return workflow.customStartDate;
  }

  /*
  |--------------------------------------------------------------------------
  | END DATE
  |--------------------------------------------------------------------------
  */

  function getEndDate(): string | null {
    if (!workflow?.customEndDate) {
      return null;
    }

    return workflow.customEndDate;
  }

  /*
  |--------------------------------------------------------------------------
  | ACTIVATE WORKFLOW
  |--------------------------------------------------------------------------
  */

  async function activateWorkflow() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      /*
      |--------------------------------------------------------------------------
      | VALIDATE
      |--------------------------------------------------------------------------
      */

      if (!workflow) {
        throw new Error(
          "Workflow data is missing. Please go back and complete the workflow."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | GET USER
      |--------------------------------------------------------------------------
      */

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please login first.");
      }

      /*
      |--------------------------------------------------------------------------
      | NORMALIZE VALUES
      |--------------------------------------------------------------------------
      */

      const databaseSource = getDatabaseSource();

      if (!databaseSource) {
        throw new Error(
          "Please select how Postoll should create or receive your content."
        );
      }

      const contentType = getContentType();

      const postsPerDay = getPostsPerDay();

      const durationType = getDurationType();

      const startDate = getStartDate();

      const endDate = getEndDate();

      const platforms = workflow.platforms ?? [];

      const approvalRequired = Boolean(
        workflow.requireApproval
      );

      const approvalBefore = workflow.requireApproval
        ? workflow.approvalTime || null
        : null;

      /*
      |--------------------------------------------------------------------------
      | VALIDATE SCHEDULE
      |--------------------------------------------------------------------------
      */

      const scheduleDays = workflow.scheduleDays ?? [];
      const scheduleSlots = workflow.scheduleSlots ?? [];

      if (scheduleDays.length === 0) {
        throw new Error("Please select at least one posting day.");
      }

      if (scheduleSlots.length === 0) {
        throw new Error("Please add at least one posting time.");
      }

      /*
      |--------------------------------------------------------------------------
      | DAY NAME -> POSTGRESQL DAY NUMBER
      |
      | Sunday    = 0
      | Monday    = 1
      | Tuesday   = 2
      | Wednesday = 3
      | Thursday  = 4
      | Friday    = 5
      | Saturday  = 6
      |--------------------------------------------------------------------------
      */

      const dayToNumber: Record<string, number> = {
        sunday: 0,
        sun: 0,

        monday: 1,
        mon: 1,

        tuesday: 2,
        tue: 2,
        tues: 2,

        wednesday: 3,
        wed: 3,

        thursday: 4,
        thu: 4,
        thurs: 4,

        friday: 5,
        fri: 5,

        saturday: 6,
        sat: 6,
      };

      /*
      |--------------------------------------------------------------------------
      | CREATE WORKFLOW
      |--------------------------------------------------------------------------
      */

      const {
        data: workflowData,
        error: workflowError,
      } = await supabase
        .from("workflows")
        .insert({
          user_id: user.id,

          name:
            workflow.name ||
            "Untitled Workflow",

          source: databaseSource,

          mode:
            databaseSource === "ai_generated"
              ? "ai_generated"
              : "user_uploaded",

          status: "active",

          active: true,

          description:
            workflow.contentDescription ||
            workflow.uploadDescription ||
            null,
        })
        .select()
        .single();

      if (workflowError) {
        throw workflowError;
      }

      if (!workflowData?.id) {
        throw new Error(
          "Workflow was created but no workflow ID was returned."
        );
      }

      const workflowId = workflowData.id;

      /*
      |--------------------------------------------------------------------------
      | CREATE WORKFLOW SETTINGS
      |--------------------------------------------------------------------------
      |
      | IMPORTANT:
      |
      | Only use columns that currently exist
      | in workflow_settings.
      |
      | Based on your Supabase schema:
      |
      | id
      | workflow_id
      | content_type
      | platforms
      | posts_per_day
      | duration_type
      | start_date
      | end_date
      | approval_required
      | approval_before
      | created_at
      |
      | DO NOT send:
      |
      | background_music
      | reel_script
      | post_script
      | brand_name
      | text_overlay
      | show_logo
      | show_page_name
      | video_mode
      | voice_over
      | voice_type
      | voice_style
      | character_enabled
      | character_type
      | character_gender
      | character_age
      | target_countries
      |
      */

      const {
        error: settingsError,
      } = await supabase
        .from("workflow_settings")
        .insert({
          workflow_id: workflowId,

          content_type: contentType,

          platforms: platforms,

          posts_per_day: postsPerDay,

          duration_type: durationType,

          start_date: startDate,

          end_date: endDate,

          approval_required: approvalRequired,

          approval_before: approvalBefore,
        });

      if (settingsError) {
        /*
        * Roll back workflow if settings creation fails.
        */

        await supabase
          .from("workflows")
          .delete()
          .eq("id", workflowId);

        throw settingsError;
      }

      /*
      |--------------------------------------------------------------------------
      | UPLOAD USER CONTENT
      |--------------------------------------------------------------------------
      |
      | Only for user_uploaded workflows.
      |
      | Files are only persisted to Supabase Storage and the
      | `content` table now, at activation time — not earlier
      | in the workflow builder.
      |
      */

      let uploadedContentIds: string[] = [];

      if (
        databaseSource === "user_uploaded" &&
        workflow.uploadFiles &&
        workflow.uploadFiles.length > 0
      ) {
        const uploadFormData = new FormData();

        uploadFormData.set("workflowId", workflowId);

        if (workflow.uploadDescription) {
          uploadFormData.set(
            "uploadDescription",
            workflow.uploadDescription
          );
        }

        workflow.uploadFiles.forEach((file: File) => {
          uploadFormData.append("files", file);
        });

        const uploadResponse = await fetch(
          "/api/workflows/upload-content",
          {
            method: "POST",
            body: uploadFormData,
          }
        );

        const uploadResult = await uploadResponse
          .json()
          .catch(() => null);

        if (
          !uploadResponse.ok ||
          !uploadResult?.success
        ) {
          /*
          * Roll back workflow + settings if the
          * upload step fails.
          */

          await supabase
            .from("workflow_settings")
            .delete()
            .eq("workflow_id", workflowId);

          await supabase
            .from("workflows")
            .delete()
            .eq("id", workflowId);

          throw new Error(
            uploadResult?.error ||
              "Unable to save uploaded content for this workflow."
          );
        }

        uploadedContentIds =
          uploadResult.contentIds ?? [];
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE WORKFLOW SCHEDULE SLOTS
      |--------------------------------------------------------------------------
      */

      const scheduleRows: Array<{
        workflow_id: string;
        user_id: string;
        day_of_week: number;
        slot_number: number;
        post_time: string;
        content_type: string;
        enabled: boolean;
        updated_at: string;
      }> = [];

      for (const day of scheduleDays) {
        let dayOfWeek: number;

        // Support numeric values such as "0", "1", etc.
        if (
          typeof day === "string" &&
          /^\d+$/.test(day.trim())
        ) {
          dayOfWeek = Number(day);
        } else {
          const normalizedDay = String(day)
            .trim()
            .toLowerCase();

          const mappedDay = dayToNumber[normalizedDay];

          if (mappedDay === undefined) {
            throw new Error(`Invalid posting day: ${day}`);
          }

          dayOfWeek = mappedDay;
        }

        if (dayOfWeek < 0 || dayOfWeek > 6) {
          throw new Error(
            `Invalid day-of-week value: ${dayOfWeek}`
          );
        }

        // Create one database row for every selected
        // day + schedule slot.
        for (const slot of scheduleSlots) {
          if (!slot.time) {
            throw new Error(
              `Schedule slot ${slot.number} is missing a time.`
            );
          }

          scheduleRows.push({
            workflow_id: workflowId,

            user_id: user.id,

            day_of_week: dayOfWeek,

            slot_number: Number(slot.number),

            post_time: slot.time,

            content_type: slot.type,

            enabled: true,

            updated_at: new Date().toISOString(),
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | SAVE WORKFLOW SCHEDULE
      |--------------------------------------------------------------------------
      */

      const { error: scheduleError } = await supabase
        .from("workflow_schedule_slots")
        .insert(scheduleRows);

      if (scheduleError) {
        // Delete uploaded content rows, if any were created.
        if (uploadedContentIds.length > 0) {
          await supabase
            .from("content")
            .delete()
            .in("id", uploadedContentIds);
        }

        // Delete schedule slots.
        await supabase
          .from("workflow_schedule_slots")
          .delete()
          .eq("workflow_id", workflowId);

        // Delete settings.
        await supabase
          .from("workflow_settings")
          .delete()
          .eq("workflow_id", workflowId);

        // Delete workflow.
        await supabase
          .from("workflows")
          .delete()
          .eq("id", workflowId);

        throw scheduleError;
      }

      /*
      |--------------------------------------------------------------------------
      | SUCCESS
      |--------------------------------------------------------------------------
      */

      setMessage(
        "Workflow activated successfully 🚀"
      );

      setTimeout(() => {
        router.push("/workflows");
      }, 1200);
    } catch (err: unknown) {
      console.error(
        "Workflow activation error:",
        err
      );

      if (
        err &&
        typeof err === "object" &&
        "message" in err
      ) {
        setError(
          String(
            (
              err as {
                message: unknown;
              }
            ).message
          )
        );
      } else {
        setError(
          "Unable to activate workflow."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DISPLAY VALUES
  |--------------------------------------------------------------------------
  */

  const databaseSource =
    getDatabaseSource();

  const sourceLabel =
    databaseSource === "ai_generated"
      ? "Postoll Creates Content"
      : databaseSource === "user_uploaded"
        ? "User Uploaded Content"
        : "Not selected";

  const contentType =
    getContentType();

  const postsPerDay =
    getPostsPerDay();

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">

        {/* HEADER */}

        <div className="mb-8 md:mb-10">
          <p
            className="text-sm font-medium"
            style={{
              color: "#a78bfa",
            }}
          >
            ✦ Workflow Builder
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Review Workflow
          </h1>

          <p
            className="mt-3 text-sm leading-6"
            style={{
              color: "var(--muted)",
            }}
          >
            Check everything before
            activating your Postoll
            workflow.
          </p>
        </div>

        {/* WORKFLOW */}

        <ReviewCard title="Workflow">
          <ReviewRow
            label="Source"
            value={sourceLabel}
          />

          <ReviewRow
            label="Content"
            value={
              workflow?.contentDescription ||
              workflow?.uploadDescription ||
              "Not provided"
            }
          />

          <ReviewRow
            label="Content Type"
            value={contentType}
          />
        </ReviewCard>

        {/* SCRIPTS */}

        <ReviewCard title="Content Scripts">
          <ReviewRow
            label="Reel Script"
            value={
              workflow?.reelScript
                ? "Ready"
                : "Will be generated by Postoll"
            }
          />

          <ReviewRow
            label="Post Script"
            value={
              workflow?.postScript
                ? "Ready"
                : "Will be generated by Postoll"
            }
          />

          <div
            className="mt-4 rounded-xl border p-4"
            style={{
              borderColor:
                "var(--border)",
              background:
                "var(--background)",
            }}
          >
            <p className="text-sm font-medium">
              Content strategy
            </p>

            <p
              className="mt-2 text-xs leading-5"
              style={{
                color: "var(--muted)",
              }}
            >
              Postoll will generate the
              detailed post or reel script
              internally when the workflow
              runs. The complete internal
              generation instructions do not
              need to be shown here.
            </p>
          </div>
        </ReviewCard>

        {/* BRANDING */}

        <ReviewCard title="Brand Visibility">
          <ReviewRow
            label="Logo"
            value={
              workflow?.showLogo
                ? workflow?.logoFile
                  ? `Enabled — ${workflow.logoFile.name}`
                  : "Enabled"
                : "Disabled"
            }
          />

          <ReviewRow
            label="Brand/Page Name"
            value={
              workflow?.showPageName
                ? workflow?.brandName ||
                  "Enabled"
                : "Disabled"
            }
          />
        </ReviewCard>

        {/* VIDEO */}

        <ReviewCard title="Video Options">
          <ReviewRow
            label="Voice Over"
            value={
              workflow?.voiceOver
                ? workflow?.voiceStyle
                  ? `Enabled — ${workflow.voiceStyle}`
                  : "Enabled"
                : "Disabled"
            }
          />

          <ReviewRow
            label="AI Character"
            value={
              workflow?.characterEnabled
                ? [
                    workflow?.characterGender,
                    workflow?.characterAge,
                  ]
                    .filter(Boolean)
                    .join(" • ") ||
                  "Enabled"
                : "Disabled"
            }
          />

          <ReviewRow
            label="Target Countries"
            value={
              workflow?.targetCountries?.length
                ? workflow.targetCountries.join(
                    ", "
                  )
                : "Not selected"
            }
          />

          <ReviewRow
            label="Background Music"
            value={
              workflow?.backgroundMusic
                ? "Enabled"
                : "Disabled"
            }
          />

          <ReviewRow
            label="Language"
            value={
              workflow?.videoLanguage ||
              workflow?.language ||
              "English"
            }
          />

          <div
            className="mt-4 rounded-xl border p-4"
            style={{
              borderColor:
                "var(--border)",
              background:
                "var(--background)",
            }}
          >
            <p className="text-sm font-medium">
              Video settings
            </p>

            <p
              className="mt-2 text-xs leading-5"
              style={{
                color: "var(--muted)",
              }}
            >
              These settings are currently
              used by the workflow builder.
              They are not written to
              workflow_settings until their
              corresponding database columns
              are added.
            </p>
          </div>
        </ReviewCard>

        {/* SCHEDULE */}

        <ReviewCard title="Schedule">
          <ReviewRow
            label="Reels per day"
            value={String(
              workflow?.reelsPerDay || 0
            )}
          />

          <ReviewRow
            label="Posts per day"
            value={String(
              workflow?.postsPerDay || 0
            )}
          />

          <ReviewRow
            label="Database posting count"
            value={String(
              postsPerDay
            )}
          />

          <ReviewRow
            label="Posting days"
            value={
              workflow?.scheduleDays?.length
                ? workflow.scheduleDays.join(
                    ", "
                  )
                : "Not selected"
            }
          />

          <ReviewRow
            label="Posting times"
            value={
              workflow?.scheduleTimes?.length
                ? workflow.scheduleTimes.join(
                    ", "
                  )
                : "Not selected"
            }
          />

          <ReviewRow
            label="Duration"
            value={
              workflow?.scheduleDuration ||
              "unlimited"
            }
          />

          {workflow?.scheduleDuration ===
            "custom" && (
            <>
              <ReviewRow
                label="Start date"
                value={
                  workflow?.customStartDate ||
                  "Not selected"
                }
              />

              <ReviewRow
                label="End date"
                value={
                  workflow?.customEndDate ||
                  "Not selected"
                }
              />
            </>
          )}
        </ReviewCard>

        {/* PLATFORMS */}

        <ReviewCard title="Platforms">
          {workflow?.platforms?.length ? (
            <div className="flex flex-wrap gap-2">
              {workflow.platforms.map(
                (platform: string) => (
                  <span
                    key={platform}
                    className="rounded-full border px-3 py-1.5 text-xs"
                    style={{
                      borderColor:
                        "var(--border)",
                      background:
                        "var(--background)",
                    }}
                  >
                    {platform}
                  </span>
                )
              )}
            </div>
          ) : (
            <p
              className="text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              No platforms selected.
            </p>
          )}
        </ReviewCard>

        {/* APPROVAL */}

        <ReviewCard title="Approval">
          <ReviewRow
            label="Publishing"
            value={
              workflow?.requireApproval
                ? "Approval required"
                : "Automatic posting"
            }
          />

          {workflow?.requireApproval && (
            <ReviewRow
              label="Notification"
              value={
                workflow?.approvalTime ||
                "Not selected"
              }
            />
          )}
        </ReviewCard>

        {/* UPLOADED CONTENT */}

        {databaseSource ===
          "user_uploaded" && (
          <ReviewCard title="Uploaded Content">
            <ReviewRow
              label="Files"
              value={
                workflow?.uploadFiles?.length
                  ? workflow.uploadFiles
                      .map(
                        (file: {
                          name: string;
                        }) => file.name
                      )
                      .join(", ")
                  : "No files selected"
              }
            />

            <ReviewRow
              label="Content Description"
              value={
                workflow?.uploadDescription ||
                "Not provided"
              }
            />

            <div
              className="mt-4 rounded-xl border p-4"
              style={{
                borderColor:
                  "rgba(139,92,246,.3)",
                background:
                  "rgba(139,92,246,.06)",
              }}
            >
              <p className="text-sm font-medium">
                Original content stays unchanged
              </p>

              <p
                className="mt-2 text-xs leading-5"
                style={{
                  color: "var(--muted)",
                }}
              >
                Postoll will publish the
                uploaded content without
                automatically adding logos,
                brand names, subtitles, or
                other edits.
              </p>
            </div>
          </ReviewCard>
        )}

        {/* SUCCESS */}

        {message && (
          <div
            className="mt-6 rounded-xl border p-4 text-sm"
            style={{
              borderColor:
                "rgba(34,197,94,.3)",
              background:
                "rgba(34,197,94,.1)",
              color: "#4ade80",
            }}
          >
            {message}
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            className="mt-6 rounded-xl border p-4 text-sm"
            style={{
              borderColor:
                "rgba(239,68,68,.3)",
              background:
                "rgba(239,68,68,.1)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {/* BUTTONS */}

        <div
          className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
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
            disabled={loading}
            className="w-full rounded-xl border px-6 py-3 text-sm font-medium sm:w-auto"
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
              loading ||
              !databaseSource
            }
            onClick={
              activateWorkflow
            }
            className="w-full rounded-xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{
              background:
                "var(--foreground)",
              color:
                "var(--background)",
            }}
          >
            {loading
              ? "Activating..."
              : "Activate Workflow 🚀"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

/*
|--------------------------------------------------------------------------
| REVIEW CARD
|--------------------------------------------------------------------------
*/

function ReviewCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-6 rounded-2xl border p-5 sm:p-6"
      style={{
        background:
          "var(--card)",
        borderColor:
          "var(--border)",
      }}
    >
      <h2 className="text-lg font-semibold sm:text-xl">
        {title}
      </h2>

      <div className="mt-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| REVIEW ROW
|--------------------------------------------------------------------------
*/

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 border-b pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
      style={{
        borderColor:
          "var(--border)",
      }}
    >
      <span
        className="shrink-0 text-sm"
        style={{
          color:
            "var(--muted)",
        }}
      >
        {label}
      </span>

      <span className="break-words text-sm font-medium sm:max-w-[65%] sm:text-right">
        {value}
      </span>
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";

const approvalOptions = [
  {
    value: "2_hours",
    label: "2 Hours Before",
    description: "Get notified two hours before publishing.",
  },
  {
    value: "1_hour",
    label: "1 Hour Before",
    description: "Get notified one hour before publishing.",
  },
  {
    value: "30_minutes",
    label: "30 Minutes Before",
    description: "Get notified 30 minutes before publishing.",
  },
];

export default function ApprovalPage() {
  const router = useRouter();

  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();

  const canContinue =
    !workflow.requireApproval ||
    !!workflow.approvalTime;

  function handleApprovalChange(
    enabled: boolean
  ) {
    updateWorkflow({
      requireApproval: enabled,
      approvalTime: enabled
        ? workflow.approvalTime
        : "",
    });
  }

  function continueNext() {
    if (!canContinue) {
      return;
    }

    router.push(
      "/workflows/create/review"
    );
  }

  return (
    <AppShell>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">

        {/* HEADER */}

        <div className="mb-8 sm:mb-10">

          <p
            className="text-sm font-medium"
            style={{
              color: "#a78bfa",
            }}
          >
            ✦ Workflow Builder
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Approval Settings
          </h1>

          <p
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{
              color: "var(--muted)",
            }}
          >
            Decide whether Postoll should ask for
            approval before publishing your generated
            content.
          </p>

        </div>

        {/* MAIN CARD */}

        <div
          className="space-y-8 rounded-2xl border p-5 sm:p-6 md:space-y-10 md:p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >

          {/* APPROVAL */}

          <section>

            <div>

              <h2 className="text-lg font-semibold sm:text-xl">
                Require Approval?
              </h2>

              <p
                className="mt-2 text-sm leading-6"
                style={{
                  color: "var(--muted)",
                }}
              >
                When enabled, Postoll will notify you
                before the scheduled content is published.
              </p>

            </div>

            {/* YES / NO */}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4">

              <button
                type="button"
                onClick={() =>
                  handleApprovalChange(true)
                }
                className="rounded-xl border px-5 py-3 font-medium transition-all duration-200"
                style={{
                  background:
                    workflow.requireApproval
                      ? "rgba(139,92,246,.12)"
                      : "var(--background)",

                  borderColor:
                    workflow.requireApproval
                      ? "#8b5cf6"
                      : "var(--border)",

                  boxShadow:
                    workflow.requireApproval
                      ? "0 0 0 2px rgba(139,92,246,.08)"
                      : "none",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {workflow.requireApproval && (
                    <span>✓</span>
                  )}
                  Yes
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleApprovalChange(false)
                }
                className="rounded-xl border px-5 py-3 font-medium transition-all duration-200"
                style={{
                  background:
                    !workflow.requireApproval
                      ? "rgba(139,92,246,.12)"
                      : "var(--background)",

                  borderColor:
                    !workflow.requireApproval
                      ? "#8b5cf6"
                      : "var(--border)",

                  boxShadow:
                    !workflow.requireApproval
                      ? "0 0 0 2px rgba(139,92,246,.08)"
                      : "none",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {!workflow.requireApproval && (
                    <span>✓</span>
                  )}
                  No
                </span>
              </button>

            </div>

          </section>

          {/* NOTIFICATION TIME */}

          {workflow.requireApproval && (

            <section>

              <h2 className="text-lg font-semibold sm:text-xl">
                Notification Time
              </h2>

              <p
                className="mt-2 text-sm leading-6"
                style={{
                  color: "var(--muted)",
                }}
              >
                Choose how early you want Postoll to
                notify you before the scheduled publishing
                time.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">

                {approvalOptions.map(
                  (option) => {

                    const selected =
                      workflow.approvalTime ===
                      option.value;

                    return (

                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateWorkflow({
                            approvalTime:
                              option.value,
                          })
                        }
                        className="rounded-2xl border p-4 text-left transition-all duration-200 sm:p-5"
                        style={{
                          background:
                            selected
                              ? "rgba(139,92,246,.12)"
                              : "var(--background)",

                          borderColor:
                            selected
                              ? "#8b5cf6"
                              : "var(--border)",

                          boxShadow:
                            selected
                              ? "0 0 0 2px rgba(139,92,246,.08)"
                              : "none",
                        }}
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="font-semibold">
                              {option.label}
                            </p>

                            <p
                              className="mt-2 text-xs leading-5 sm:text-sm"
                              style={{
                                color:
                                  "var(--muted)",
                              }}
                            >
                              {option.description}
                            </p>

                          </div>

                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                            style={{
                              background:
                                selected
                                  ? "#8b5cf6"
                                  : "transparent",

                              borderColor:
                                selected
                                  ? "#8b5cf6"
                                  : "var(--border)",

                              color:
                                selected
                                  ? "white"
                                  : "transparent",
                            }}
                          >
                            ✓
                          </div>

                        </div>

                      </button>

                    );
                  }
                )}

              </div>

              {!workflow.approvalTime && (

                <p
                  className="mt-3 text-sm"
                  style={{
                    color: "#f59e0b",
                  }}
                >
                  Please select when Postoll should notify
                  you.
                </p>

              )}

            </section>

          )}

          {/* WHAT HAPPENS */}

          <section
            className="rounded-2xl border p-5 sm:p-6"
            style={{
              borderColor: "var(--border)",
              background:
                "var(--background)",
            }}
          >

            <h3 className="font-semibold">
              What happens after notification?
            </h3>

            <div
              className="mt-4 grid gap-3 text-sm sm:grid-cols-2"
              style={{
                color: "var(--muted)",
              }}
            >

              <div className="flex gap-3">
                <span className="shrink-0">
                  ✓
                </span>
                <span>
                  Open your Postoll dashboard.
                </span>
              </div>

              <div className="flex gap-3">
                <span className="shrink-0">
                  ✓
                </span>
                <span>
                  Preview the generated post or reel.
                </span>
              </div>

              <div className="flex gap-3">
                <span className="shrink-0">
                  ✓
                </span>
                <span>
                  Edit or regenerate content when available.
                </span>
              </div>

              <div className="flex gap-3">
                <span className="shrink-0">
                  ✓
                </span>
                <span>
                  Approve and publish the content.
                </span>
              </div>

              <div className="flex gap-3 sm:col-span-2">
                <span className="shrink-0">
                  ✓
                </span>
                <span>
                  If no action is required, Postoll can
                  publish automatically according to your
                  workflow settings.
                </span>
              </div>

            </div>

          </section>

          {/* NAVIGATION */}

          <div
            className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: "var(--border)",
            }}
          >

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="w-full rounded-xl border px-6 py-3 font-medium transition hover:opacity-80 sm:w-auto"
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={!canContinue}
              onClick={continueNext}
              className="w-full rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
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

"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";

const platforms = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    description: "Post reels, images and captions automatically.",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "📘",
    description: "Publish content to your Facebook pages.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    description: "Share professional content automatically.",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    icon: "𝕏",
    description: "Publish updates and threads.",
  },
];

export default function AccountsPage() {
  const router = useRouter();

  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();

  function togglePlatform(id: string) {
    const selected = workflow.platforms || [];

    if (selected.includes(id)) {
      updateWorkflow({
        platforms: selected.filter(
          (item) => item !== id
        ),
      });
    } else {
      updateWorkflow({
        platforms: [
          ...selected,
          id,
        ],
      });
    }
  }

  const canContinue =
    (workflow.platforms || []).length > 0;

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
            ✦ Workflow Builder
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Connect Social Accounts
          </h1>

          <p
            className="mt-3 text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            Choose where Postoll should publish
            this workflow content.
          </p>

        </div>

        {/* MAIN CARD */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >

          <h2 className="text-xl font-semibold">
            Select Platforms
          </h2>

          <p
            className="mt-2 text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            You can select multiple platforms
            for the same workflow.
          </p>

          {/* PLATFORM GRID */}
          <div className="mt-8 grid gap-5 md:grid-cols-2">

            {platforms.map((platform) => {

              const selected =
                workflow.platforms?.includes(
                  platform.id
                ) ?? false;

              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() =>
                    togglePlatform(platform.id)
                  }
                  className="rounded-2xl border p-6 text-left transition hover:-translate-y-1"
                  style={{
                    background: selected
                      ? "rgba(139,92,246,.12)"
                      : "var(--background)",

                    borderColor: selected
                      ? "#8b5cf6"
                      : "var(--border)",
                  }}
                >

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-4">

                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl"
                      >
                        {platform.icon}
                      </div>

                      <div>

                        <h3 className="text-lg font-semibold">
                          {platform.name}
                        </h3>

                        <p
                          className="mt-1 text-sm"
                          style={{
                            color: "var(--muted)",
                          }}
                        >
                          {platform.description}
                        </p>

                      </div>

                    </div>

                    <div>

                      {selected ? (
                        <span className="text-sm">
                          ✓
                        </span>
                      ) : (
                        <span
                          className="text-sm"
                          style={{
                            color: "var(--muted)",
                          }}
                        >
                          +
                        </span>
                      )}

                    </div>

                  </div>

                  <div
                    className="mt-5 rounded-xl border p-3 text-sm"
                    style={{
                      borderColor: "var(--border)",
                    }}
                  >
                    {selected
                      ? "Selected — account connection will be configured next."
                      : "Select this platform"}
                  </div>

                </button>
              );
            })}

          </div>

          {/* BUTTONS */}
          <div
            className="mt-10 flex justify-between border-t pt-6"
            style={{
              borderColor: "var(--border)",
            }}
          >

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border px-6 py-3"
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={!canContinue}
              onClick={() =>
                router.push(
                  "/workflows/create/approval"
                )
              }
              className="rounded-xl px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
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
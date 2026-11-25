"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../AppShell";
import { useWorkflow } from "./context";

export default function CreateWorkflowPage() {
  return <CreateWorkflowContent />;
}

function CreateWorkflowContent() {
  const router = useRouter();
  const { workflow, updateWorkflow, resetWorkflow } = useWorkflow();

  useEffect(() => {
    resetWorkflow();
    updateWorkflow({ source: "user_uploaded" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continueNext() {
    if (!workflow.name.trim()) return;
    updateWorkflow({ source: "user_uploaded" });
    router.push("/workflows/create/upload");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        {/* HEADER */}
        <div className="mb-10">
          <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
            ✦ Workflow Builder
          </p>

          <h1 className="mt-2 text-4xl font-bold">Create Workflow</h1>

          <p
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{ color: "var(--muted)" }}
          >
            Upload your videos or images and let Postoll schedule and publish
            them automatically.
          </p>
        </div>

        {/* STEP INDICATOR */}
        <div className="mb-10 flex items-center gap-3">
          <div
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: "#8b5cf6", color: "#fff" }}
          >
            1
          </div>

          <span className="text-sm">Workflow Details</span>

          <div
            className="h-px flex-1"
            style={{ background: "var(--border)" }}
          />

          <div
            className="rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            2
          </div>

          <span
            className="hidden text-sm md:block"
            style={{ color: "var(--muted)" }}
          >
            Upload &amp; Schedule
          </span>
        </div>

        <div
          className="rounded-2xl border p-8"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* WORKFLOW NAME */}
          <div className="mb-8">
            <label className="text-sm font-medium">Workflow Name</label>

            <input
              value={workflow.name}
              onChange={(e) => updateWorkflow({ name: e.target.value })}
              placeholder="Example: Daily Reels Upload"
              className="mt-3 w-full rounded-xl border p-4 outline-none"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
              }}
            />
          </div>

          {/* SINGLE UPLOAD MODE CARD */}
          <div
            className="rounded-2xl border p-6 text-left"
            style={{
              background: "rgba(139,92,246,.12)",
              borderColor: "#8b5cf6",
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl">
              📤
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Upload Your Content, We Post
            </h2>

            <p
              className="mt-3 text-sm leading-6"
              style={{ color: "var(--muted)" }}
            >
              Upload your own videos or images. Postoll prepares captions and
              hashtags and publishes on your schedule.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Upload Video", "Upload Image", "Auto Publish"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{ borderColor: "var(--border)" }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div
            className="mt-10 flex justify-end border-t pt-6"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="button"
              disabled={!workflow.name.trim()}
              onClick={continueNext}
              className="rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-40"
              style={{
                background: "#8b5cf6",
                color: "#ffffff",
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

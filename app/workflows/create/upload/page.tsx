"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UploadContentPage() {
  const router = useRouter();
  const supabase = createClient();

  const { workflow, updateWorkflow } = useWorkflow();

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const selectedFile = workflow.uploadFiles?.[0] ?? null;

  const canContinue =
    Boolean(selectedFile) &&
    Boolean((workflow.name || "").trim()) &&
    workflow.uploadDescription.trim().length > 0;

  function handleSingleFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    updateWorkflow({ uploadFiles: [file] });
  }

  function removeFile() {
    setUploadError("");
    updateWorkflow({ uploadFiles: [] });
  }

  async function continueNext() {
    if (!canContinue || uploading || !selectedFile) {
      return;
    }

    try {
      setUploading(true);
      setUploadError("");

      let finalUrl: string;

      if (typeof selectedFile === "string") {
        finalUrl = selectedFile;
      } else {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from("workflow-media")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (storageError) {
          throw new Error(
            `Failed to upload ${selectedFile.name}: ${storageError.message}`
          );
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("workflow-media").getPublicUrl(filePath);

        finalUrl = publicUrl;
      }

      updateWorkflow({
        source: "user_uploaded",
        name: (workflow.name || "").trim(),
        uploadFiles: [finalUrl] as any,
      });

      router.push("/workflows/create/schedule");
    } catch (err: any) {
      console.error("Direct upload error:", err);
      setUploadError(err.message || "Failed to upload file to storage.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        {/* HEADER */}
        <div className="mb-10">
          <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
            ✦ Workflow Builder
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Upload Your Content — We Post It For You
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Name your workflow, upload a single video or image, and Postoll
            schedules and posts it for you automatically.
          </p>
        </div>

        {/* MAIN CARD */}
        <div
          className="space-y-8 rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          {/* WORKFLOW NAME */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Workflow Name</label>
              <span className="text-xs" style={{ color: "#8b5cf6" }}>
                Required
              </span>
            </div>

            <input
              value={workflow.name || ""}
              onChange={(e) => updateWorkflow({ name: e.target.value })}
              placeholder="Example: Weekly Product Reels"
              className="mt-3 w-full rounded-xl border p-4 outline-none transition focus:border-purple-500"
              style={{
                background: "var(--background)",
                borderColor: (workflow.name || "").trim()
                  ? "#8b5cf6"
                  : "var(--border)",
              }}
            />
          </div>

          {/* UPLOAD */}
          <div>
            <h2 className="text-xl font-semibold">Upload Content</h2>

            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Upload one video or image file for this workflow. Selecting another
              file replaces the current one.
            </p>

            <label
              className="mt-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed transition hover:border-purple-500"
              style={{
                borderColor: selectedFile ? "#8b5cf6" : "var(--border)",
                background: selectedFile
                  ? "rgba(139,92,246,.08)"
                  : "var(--background)",
              }}
            >
              <div className="text-4xl">📤</div>

              <p className="mt-3 text-sm font-medium">
                {selectedFile
                  ? "Click to replace selected file"
                  : "Click to upload a single file"}
              </p>

              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                MP4, MOV, JPG, PNG — 1 file per workflow
              </p>

              <input
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleSingleFile(file);
                  e.target.value = "";
                }}
              />
            </label>

            {/* SELECTED FILE */}
            {selectedFile && (
              <div
                className="mt-4 rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                }}
              >
                <p className="font-medium">Selected File (1 of 1)</p>

                <div className="mt-3">
                  <div
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: "var(--background)",
                    }}
                  >
                    <span className="truncate pr-3">
                      {typeof selectedFile === "string"
                        ? selectedFile
                        : selectedFile.name}
                    </span>

                    <div className="flex shrink-0 items-center gap-3">
                      {typeof selectedFile !== "string" && (
                        <span
                          className="text-xs"
                          style={{
                            color: "var(--muted)",
                          }}
                        >
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={removeFile}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DESCRIPTION & CAPTION */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Tell Postoll about this content
              </label>

              <span
                className="text-xs"
                style={{
                  color:
                    workflow.uploadDescription.trim().length > 0
                      ? "#8b5cf6"
                      : "var(--muted)",
                }}
              >
                Required
              </span>
            </div>

            <textarea
              value={workflow.uploadDescription}
              onChange={(e) =>
                updateWorkflow({
                  uploadDescription: e.target.value,
                })
              }
              placeholder="Example: This is a new product launch video for our luxury watch collection. The video shows the watch, its design and premium features."
              className="mt-3 min-h-36 w-full rounded-xl border p-4 outline-none transition focus:border-purple-500"
              style={{
                background: "var(--background)",
                borderColor:
                  workflow.uploadDescription.trim().length > 0
                    ? "#8b5cf6"
                    : "var(--border)",
              }}
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={aiLoading || workflow.uploadDescription.trim().length < 10}
                onClick={async () => {
                  setAiError("");
                  setAiLoading(true);
                  try {
                    const res = await fetch("/api/ai/caption", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        description: workflow.uploadDescription,
                        contentType: "post",
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(data.error || "Generate failed");
                    }
                    const tags = (data.hashtags || [])
                      .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
                      .join(" ");
                    updateWorkflow({
                      uploadDescription: [data.caption, tags]
                        .filter(Boolean)
                        .join("\n\n"),
                    });
                  } catch (e) {
                    setAiError(
                      e instanceof Error ? e.message : "Generate failed"
                    );
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
                style={{
                  background: "#8b5cf6",
                  color: "#fff",
                }}
              >
                {aiLoading ? "Generating…" : "✨ Generate caption & hashtags"}
              </button>
              {aiError && (
                <span className="text-xs text-red-400">{aiError}</span>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {uploadError}
            </div>
          )}

          {/* BUTTONS */}
          <div
            className="flex justify-between border-t pt-6"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/workflows")}
              className="rounded-xl border px-6 py-3 text-sm font-medium"
              style={{
                borderColor: "var(--border)",
              }}
            >
              ← Back to Workflows
            </button>

            <button
              type="button"
              disabled={!canContinue || uploading}
              onClick={continueNext}
              className="rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-40"
              style={{
                background: "#8b5cf6",
                color: "#fff",
              }}
            >
              {uploading ? "Uploading…" : "Continue to Schedule →"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

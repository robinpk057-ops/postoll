"use client";

import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";


export default function UploadContentPage() {

  const router = useRouter();

  const {
    workflow,
    updateWorkflow,
  } = useWorkflow();


  const canContinue =
    workflow.uploadFiles.length > 0 &&
    workflow.uploadDescription.trim().length > 0;


  function handleFiles(
    files: File[]
  ) {

    updateWorkflow({
      uploadFiles: files,
    });

  }


  function continueNext() {

    if (!canContinue) {
      return;
    }


    updateWorkflow({
      source: "user_uploaded",
    });


    router.push(
      "/workflows/create/schedule"
    );

  }


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
            Upload Your Content
          </h1>


          <p
            className="mt-3 text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            Upload your video or image and tell
            Postoll what the content is about.
          </p>

        </div>


        {/* STEP */}

        <div className="mb-10 flex items-center gap-3">

          <div
            className="rounded-full border px-4 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--muted)",
            }}
          >
            1
          </div>


          <span
            className="text-sm"
            style={{
              color: "var(--muted)",
            }}
          >
            Source
          </span>


          <div
            className="h-px flex-1"
            style={{
              background: "var(--border)",
            }}
          />


          <div
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{
              background: "#8b5cf6",
              color: "#fff",
            }}
          >
            2
          </div>


          <span className="text-sm">
            Upload Content
          </span>

        </div>


        {/* MAIN CARD */}

        <div
          className="space-y-8 rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >


          {/* UPLOAD */}

          <div>

            <h2 className="text-xl font-semibold">
              Upload Files
            </h2>


            <p
              className="mt-2 text-sm"
              style={{
                color: "var(--muted)",
              }}
            >
              Upload the original video or image
              that you want Postoll to publish.
            </p>


            <label
              className="mt-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed transition hover:border-purple-500"
              style={{
                borderColor:
                  workflow.uploadFiles.length > 0
                    ? "#8b5cf6"
                    : "var(--border)",

                background:
                  workflow.uploadFiles.length > 0
                    ? "rgba(139,92,246,.08)"
                    : "var(--background)",
              }}
            >

              <div className="text-4xl">
                📤
              </div>


              <p className="mt-3 text-sm font-medium">
                Click to upload
              </p>


              <p
                className="mt-1 text-xs"
                style={{
                  color: "var(--muted)",
                }}
              >
                MP4, MOV, JPG, PNG
              </p>


              <input
                type="file"
                multiple
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {

                  const files =
                    Array.from(
                      e.target.files || []
                    );


                  handleFiles(files);

                }}
              />

            </label>


            {/* SELECTED FILES */}

            {workflow.uploadFiles.length > 0 && (

              <div
                className="mt-4 rounded-xl border p-4"
                style={{
                  borderColor: "var(--border)",
                }}
              >

                <p className="font-medium">
                  Selected Files
                </p>


                <div className="mt-3 space-y-2">

                  {workflow.uploadFiles.map(
                    (file, index) => (

                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                        style={{
                          background:
                            "var(--background)",
                        }}
                      >

                        <span>
                          {file.name}
                        </span>


                        <span
                          className="text-xs"
                          style={{
                            color: "var(--muted)",
                          }}
                        >
                          {(file.size / 1024 / 1024).toFixed(2)}
                          {" "}
                          MB
                        </span>

                      </div>

                    )
                  )}

                </div>

              </div>

            )}

          </div>


          {/* DESCRIPTION */}

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

              value={
                workflow.uploadDescription
              }

              onChange={(e) =>
                updateWorkflow({
                  uploadDescription:
                    e.target.value,
                })
              }

              placeholder="Example: This is a new product launch video for our luxury watch collection. The video shows the watch, its design and premium features."

              className="mt-3 min-h-36 w-full rounded-xl border p-4 outline-none transition focus:border-purple-500"

              style={{
                background:
                  "var(--background)",

                borderColor:
                  workflow.uploadDescription.trim().length > 0
                    ? "#8b5cf6"
                    : "var(--border)",
              }}

            />


            <p
              className="mt-2 text-xs"
              style={{
                color: "var(--muted)",
              }}
            >
              This information will later be used by
              Postoll to understand the content and
              create the appropriate publishing workflow.
            </p>

          </div>


          {/* ORIGINAL CONTENT NOTICE */}

          <div
            className="rounded-xl border p-4"
            style={{
              background:
                "rgba(139,92,246,.06)",
              borderColor:
                "rgba(139,92,246,.3)",
            }}
          >

            <div className="flex gap-3">

              <span className="text-lg">
                🔒
              </span>


              <div>

                <p className="text-sm font-medium">
                  Your original content stays unchanged
                </p>


                <p
                  className="mt-1 text-xs"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Postoll will not automatically add
                  logos, brand names, subtitles or other
                  edits to your uploaded content.
                </p>

              </div>

            </div>

          </div>


          {/* BUTTONS */}

          <div
            className="flex justify-between border-t pt-6"
            style={{
              borderColor: "var(--border)",
            }}
          >

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="rounded-xl border px-6 py-3"
              style={{
                borderColor:
                  "var(--border)",
              }}
            >
              ← Back
            </button>


            <button
              type="button"
              disabled={!canContinue}
              onClick={continueNext}
              className="rounded-xl px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
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
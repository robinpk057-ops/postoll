"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "../AppShell";
import { createClient } from "@/lib/supabase/client";


type Workflow = {
  id: string;
  name: string;
  mode: string;
  description: string | null;
  active: boolean;
  created_at: string;
  thumbnail_url: string | null;
};


export default function WorkflowsPage() {

  const supabase = createClient();


  const [workflows, setWorkflows] =
    useState<Workflow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [confirmId, setConfirmId] =
    useState<string | null>(null);



  async function loadWorkflows() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please login first.");
        return;
      }

      const { data, error } = await supabase
        .from("workflows")
        .select(
          `
          id,
          name,
          mode,
          description,
          active,
          created_at
          `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const list = data || [];

      const withThumbs: Workflow[] = await Promise.all(
        list.map(async (w) => {
          const { data: content } = await supabase
            .from("content")
            .select("image_url")
            .eq("workflow_id", w.id)
            .not("image_url", "is", null)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...w,
            thumbnail_url: content?.image_url ?? null,
          };
        })
      );

      setWorkflows(withThumbs);
    } catch (err) {
      console.error("Load workflow error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load workflows."
      );
    } finally {
      setLoading(false);
    }
  }


  async function deleteWorkflow(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed"
      );
    } finally {
      setDeletingId(null);
    }
  }



  useEffect(() => {

    loadWorkflows();

  }, []);




  return (

    <AppShell>


      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">


        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">


          <div>

            <h1 className="text-4xl font-bold">
              Workflows
            </h1>


            <p
              className="mt-3 text-sm"
              style={{
                color: "var(--muted)"
              }}
            >
              Create automated content systems
              for your brands.
            </p>

          </div>



          <Link
            href="/workflows/create"
            className="rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: "var(--foreground)",
              color: "var(--background)"
            }}
          >
            + Create Workflow
          </Link>


        </div>





        {error && (

          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">

            {error}

          </div>

        )}






        {loading && (

          <div className="grid gap-5 md:grid-cols-3">

            {[1, 2, 3].map(item => (

              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)"
                }}
              />

            ))}

          </div>

        )}






        {!loading &&
          workflows.length === 0 && (


            <div
              className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed text-center"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)"
              }}
            >

              <div>


                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl">
                  ✦
                </div>



                <h2 className="mt-5 text-xl font-semibold">
                  No workflows yet
                </h2>


                <p
                  className="mt-2 max-w-md text-sm"
                  style={{
                    color: "var(--muted)"
                  }}
                >
                  Create your first automated AI content workflow.
                </p>



                <Link
                  href="/workflows/create"
                  className="mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-semibold"
                  style={{
                    background: "var(--foreground)",
                    color: "var(--background)"
                  }}
                >
                  Create Workflow
                </Link>


              </div>


            </div>


          )}






        {!loading &&
          workflows.length > 0 && (


            <div className="grid gap-6 md:grid-cols-3">


              {
                workflows.map(workflow => (


                  workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="rounded-2xl border p-6 transition hover:-translate-y-1"
                      style={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border"
                          style={{ borderColor: "var(--border)" }}
                        >
                          {workflow.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={workflow.thumbnail_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] opacity-50">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="text-xl font-semibold truncate">
                              {workflow.name}
                            </h2>
                            <span
                              className="shrink-0 rounded-full px-3 py-1 text-xs"
                              style={{
                                background: workflow.active
                                  ? "rgba(34,197,94,.15)"
                                  : "rgba(156,163,175,.15)",
                                color: workflow.active
                                  ? "#22c55e"
                                  : "#9ca3af",
                              }}
                            >
                              {workflow.active ? "Active" : "Paused"}
                            </span>
                          </div>

                          <p
                            className="mt-2 text-sm line-clamp-2"
                            style={{ color: "var(--muted)" }}
                          >
                            {workflow.description ||
                              "AI generated content workflow"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 text-sm">
                        Mode:
                        <span className="ml-2 font-medium">
                          {workflow.mode}
                        </span>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setConfirmId(workflow.id)}
                          className="rounded-lg border px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))


                ))
              }


            </div>


          )}



      </div>


      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <h3 className="text-lg font-semibold">Delete workflow?</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              This removes the workflow, schedule, and related content. This
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-xl border px-4 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmId}
                onClick={() => {
                  if (confirmId) {
                    deleteWorkflow(confirmId);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deletingId === confirmId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}


    </AppShell>

  );

}
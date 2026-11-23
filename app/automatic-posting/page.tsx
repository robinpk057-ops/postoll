"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type WorkflowRow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  status?: string | null;
  created_at?: string | null;
};

type ScheduleSlotRow = {
  id: string;
  workflow_id: string;
  day_of_week: number;
  slot_number: number;
  post_time: string;
  content_type: string;
  enabled: boolean;
};

type ScheduleRunRow = {
  id: string;
  schedule_slot_id: string | null;
  workflow_id: string;
  run_date: string;
  status: string;
  content_id: string | null;
  error_message: string | null;
  created_at?: string | null;
};

type GenerationJobRow = {
  id: string;
  workflow_id: string;
  run_date: string;
  status: string;
  output_post_id: string | null;
  error_message: string | null;
  created_at?: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getSupabaseBrowserClient() {
  return createClient();
}

export default function AutomaticPostingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [slots, setSlots] = useState<ScheduleSlotRow[]>([]);
  const [runs, setRuns] = useState<ScheduleRunRow[]>([]);
  const [jobs, setJobs] = useState<GenerationJobRow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [runningDaily, setRunningDaily] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const [wfRes, slotRes, runRes, jobRes] = await Promise.all([
        supabase.from("workflows").select("*").order("created_at", { ascending: false }),
        supabase
          .from("workflow_schedule_slots")
          .select("id, workflow_id, day_of_week, slot_number, post_time, content_type, enabled")
          .order("day_of_week", { ascending: true })
          .order("post_time", { ascending: true }),
        supabase
          .from("workflow_schedule_runs")
          .select("id, schedule_slot_id, workflow_id, run_date, status, content_id, error_message, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("generation_jobs")
          .select("id, workflow_id, run_date, status, output_post_id, error_message, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (wfRes.error) throw new Error(wfRes.error.message);
      if (slotRes.error) throw new Error(slotRes.error.message);
      if (runRes.error) throw new Error(runRes.error.message);
      if (jobRes.error) throw new Error(jobRes.error.message);

      const wfList = (wfRes.data || []) as WorkflowRow[];
      setWorkflows(wfList);
      setSlots((slotRes.data || []) as ScheduleSlotRow[]);
      setRuns((runRes.data || []) as ScheduleRunRow[]);
      setJobs((jobRes.data || []) as GenerationJobRow[]);

      if (wfList.length > 0 && !selectedWorkflowId) {
        setSelectedWorkflowId(wfList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automatic posting data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRunDailyNow() {
    if (!selectedWorkflowId) return;
    setRunningDaily(true);
    setActionMessage(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/ai-director/run-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: selectedWorkflowId,
          runDate: today,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to trigger daily generation.");
      }

      setActionMessage(
        `Daily run finished for ${today}: job ${data?.job?.id || "ok"} (post ${data?.job?.output_post_id || "none"}).`
      );
      await loadData();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Error triggering daily generation.");
    } finally {
      setRunningDaily(false);
    }
  }

  const activeWorkflowCount = workflows.filter((w) => w.active === true).length;
  const enabledSlotCount = slots.filter((s) => s.enabled).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automatic Posting</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Monitor schedule slots, daily AI director generation jobs, and automated publish runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name || wf.id}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRunDailyNow}
            disabled={runningDaily || !selectedWorkflowId}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
            }}
          >
            {runningDaily ? "Generating..." : "Run Daily Now"}
          </button>

          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border px-3 py-2 text-sm font-medium"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Active Workflows
          </div>
          <div className="mt-2 text-2xl font-bold">
            {activeWorkflowCount} / {workflows.length}
          </div>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Enabled Schedule Slots
          </div>
          <div className="mt-2 text-2xl font-bold">
            {enabledSlotCount} / {slots.length}
          </div>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Recent Runs Logged
          </div>
          <div className="mt-2 text-2xl font-bold">{runs.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          Loading automatic posting status...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Enabled Schedule Slots</h2>
              <Link href="/workflows" className="text-xs underline" style={{ color: "var(--muted)" }}>
                Manage Workflows
              </Link>
            </div>
            {slots.filter((s) => s.enabled).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No enabled schedule slots found.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {slots
                  .filter((s) => s.enabled)
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span>
                        <strong>{DAYS[slot.day_of_week] ?? slot.day_of_week}</strong> · {slot.post_time} ·{" "}
                        {slot.content_type}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        wf:{slot.workflow_id.slice(0, 8)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="mb-4 text-lg font-semibold">Recent AI Director Jobs</h2>
            {jobs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No generation jobs recorded yet.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <span className="font-medium">{job.run_date}</span> ·{" "}
                      <span>{job.status}</span>
                      {job.error_message && (
                        <div className="text-xs text-red-400">{job.error_message}</div>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {job.output_post_id ? `post:${job.output_post_id.slice(0, 8)}` : "no post"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border p-5 lg:col-span-2"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="mb-4 text-lg font-semibold">Recent Scheduler Publish Runs</h2>
            {runs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No schedule runs recorded yet.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <span className="font-medium">{run.run_date}</span> ·{" "}
                      <span>{run.status}</span>
                      {run.error_message && (
                        <span className="ml-2 text-xs text-red-400">({run.error_message})</span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      wf:{run.workflow_id.slice(0, 8)}
                      {run.content_id ? ` · content:${run.content_id.slice(0, 8)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}


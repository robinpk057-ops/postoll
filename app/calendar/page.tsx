"use client";

import Link from "next/link";
import AppShell from "../AppShell";

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <p
          className="text-sm font-medium"
          style={{ color: "#a78bfa" }}
        >
          ✦ Medium plan
        </p>

        <h1 className="mt-2 text-4xl font-bold">Calendar</h1>

        <p
          className="mt-3 max-w-2xl text-sm"
          style={{ color: "var(--muted)" }}
        >
          Plan posts day by day for the next 30 days — multiple posts per day,
          custom times, and status tracking. This feature is part of the
          Medium plan and is coming soon.
        </p>

        <div
          className="mt-10 rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-lg font-semibold">Coming soon</p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--muted)" }}
          >
            You’ll see a 30-day grid here. Each day will support upload,
            description, time, and post status.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/workflows/create"
              className="rounded-xl px-5 py-3 text-sm font-semibold"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              Use Base workflow →
            </Link>
            <Link
              href="/"
              className="rounded-xl border px-5 py-3 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
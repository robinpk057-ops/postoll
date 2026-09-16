import AppShell from "../AppShell";

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        <h1 className="text-3xl font-semibold">
          Calendar
        </h1>

        <p
          className="mt-2"
          style={{ color: "var(--muted)" }}
        >
          Plan and schedule your content.
        </p>
      </div>
    </AppShell>
  );
}
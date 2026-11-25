"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  name: string;
  subtitle: string;
  href: string;
  icon: string;
  badgeBg: string;
  badgeColor: string;
};

const navItems: NavItem[] = [
  {
    name: "Home",
    subtitle: "Content library",
    href: "/",
    icon: "⌂",
    badgeBg: "rgba(124, 92, 255, 0.18)",
    badgeColor: "#C4B5FD",
  },
  {
    name: "Create",
    subtitle: "Posts & reels",
    href: "/create",
    icon: "✦",
    badgeBg: "rgba(236, 72, 153, 0.18)",
    badgeColor: "#F9A8D4",
  },
  {
    name: "Workflows",
    subtitle: "AI pipelines",
    href: "/workflows",
    icon: "◈",
    badgeBg: "rgba(56, 189, 248, 0.18)",
    badgeColor: "#7DD3FC",
  },
  {
    name: "Auto Posting",
    subtitle: "Schedule slots",
    href: "/automatic-posting",
    icon: "⟳",
    badgeBg: "rgba(16, 185, 129, 0.18)",
    badgeColor: "#6EE7B7",
  },
  {
    name: "Calendar",
    subtitle: "Publishing queue",
    href: "/calendar",
    icon: "◫",
    badgeBg: "rgba(251, 191, 36, 0.18)",
    badgeColor: "#FDE68A",
  },
  {
    name: "Accounts",
    subtitle: "Connected channels",
    href: "/accounts",
    icon: "◎",
    badgeBg: "rgba(168, 85, 247, 0.18)",
    badgeColor: "#E9D5FF",
  },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const content = (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5">
      <div>
        {/* Brand Header */}
        <div className="mb-7 flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 group"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-black text-white shadow-md transition-transform group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
              }}
            >
              P
            </span>
            <div>
              <span className="block text-xl font-black tracking-tight">
                Postoll
              </span>
              <span
                className="block text-[11px] font-medium"
                style={{ color: "var(--muted)" }}
              >
                AI Social Studio
              </span>
            </div>
          </Link>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold lg:hidden"
              style={{ borderColor: "var(--border)" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3.5 rounded-2xl border px-3.5 py-3 transition-all"
                style={{
                  background: isActive
                    ? "rgba(124, 92, 255, 0.16)"
                    : "transparent",
                  borderColor: isActive
                    ? "rgba(124, 92, 255, 0.55)"
                    : "transparent",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                  style={{
                    background: item.badgeBg,
                    color: item.badgeColor,
                  }}
                >
                  {item.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold leading-tight">
                    {item.name}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.subtitle}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Studio Card */}
      <div
        className="mt-8 rounded-2xl border p-4"
        style={{
          background:
            "linear-gradient(145deg, rgba(124,92,255,0.14), rgba(16,185,129,0.08))",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C4B5FD]">
            Autopilot Engine
          </span>
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <p
          className="mt-1.5 text-xs leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Schedule slots, AI reels, and multi-channel queues stay synchronized.
        </p>
        <Link
          href="/settings"
          onClick={onClose}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-90"
          style={{
            borderColor: "var(--border)",
            background: "var(--card)",
            color: "var(--foreground)",
          }}
        >
          ⚙ Studio &amp; Slot Settings
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Wide Tablet Sidebar */}
      <aside
        className="hidden w-72 shrink-0 border-r lg:block"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        {content}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside
            className="relative z-10 h-full w-80 max-w-[85vw] overflow-y-auto border-r shadow-2xl"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

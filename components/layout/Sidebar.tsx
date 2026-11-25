"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  name: string;
  href: string;
  icon: string;
  activeBg: string;
  iconColor: string;
};

const navItems: NavItem[] = [
  {
    name: "Home",
    href: "/",
    icon: "⌂",
    activeBg: "rgba(124, 92, 255, 0.22)",
    iconColor: "#C4B5FD",
  },
  {
    name: "Create",
    href: "/create",
    icon: "✦",
    activeBg: "rgba(236, 72, 153, 0.22)",
    iconColor: "#F9A8D4",
  },
  {
    name: "Workflows",
    href: "/workflows",
    icon: "◈",
    activeBg: "rgba(56, 189, 248, 0.22)",
    iconColor: "#7DD3FC",
  },
  {
    name: "Auto Post",
    href: "/automatic-posting",
    icon: "⟳",
    activeBg: "rgba(16, 185, 129, 0.22)",
    iconColor: "#6EE7B7",
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: "◫",
    activeBg: "rgba(251, 191, 36, 0.22)",
    iconColor: "#FDE68A",
  },
  {
    name: "Accounts",
    href: "/accounts",
    icon: "◎",
    activeBg: "rgba(168, 85, 247, 0.22)",
    iconColor: "#E9D5FF",
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

  const railContent = (
    <div className="flex h-full flex-col items-center justify-between py-4 px-2">
      <div className="flex w-full flex-col items-center gap-5">
        <Link
          href="/"
          onClick={onClose}
          title="Postoll Studio"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg transition hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
          }}
        >
          P
        </Link>

        <nav
          className="flex w-full flex-col items-center gap-2"
          aria-label="Workspace navigation"
        >
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
                className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2.5 px-1 text-center transition"
                style={{
                  background: isActive ? item.activeBg : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--muted)",
                  border: isActive
                    ? "1px solid rgba(255,255,255,0.16)"
                    : "1px solid transparent",
                }}
              >
                <span
                  className="text-lg font-bold leading-none"
                  style={{ color: isActive ? "#FFFFFF" : item.iconColor }}
                >
                  {item.icon}
                </span>
                <span className="text-[11px] font-bold tracking-tight leading-tight">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/settings"
        onClick={onClose}
        title="Settings"
        className="mt-6 flex w-full flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-center transition hover:bg-white/5"
        style={{ color: "var(--muted)" }}
      >
        <span className="text-base leading-none">⚙</span>
        <span className="text-[11px] font-semibold">Settings</span>
      </Link>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Compact Vertical Icon Rail (matching Leonardo rail width) */}
      <aside
        className="hidden w-[84px] shrink-0 border-r md:block"
        style={{
          background: "#0B0B0F",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        {railContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside
            className="relative z-10 h-full w-64 max-w-[80vw] overflow-y-auto border-r p-4 shadow-2xl"
            style={{
              background: "#0B0B0F",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-black tracking-tight text-white">
                Postoll
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-xs font-bold text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <nav className="space-y-1.5" aria-label="Mobile navigation">
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
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition"
                    style={{
                      background: isActive ? item.activeBg : "transparent",
                      color: isActive ? "#FFFFFF" : "var(--foreground)",
                    }}
                  >
                    <span style={{ color: item.iconColor }}>{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <Link
                href="/settings"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold"
                style={{ color: "var(--foreground)" }}
              >
                <span>⚙</span>
                <span>Settings</span>
              </Link>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

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
    name: "Home Studio",
    href: "/",
    icon: "⌂",
    activeBg: "rgba(124, 92, 255, 0.22)",
    iconColor: "#C4B5FD",
  },
  {
    name: "Create AI",
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
    name: "Auto Posting",
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
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="mb-6 flex items-center justify-between px-1">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white shadow-md"
              style={{
                background: "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
              }}
            >
              P
            </span>
            <span className="text-xl font-black tracking-tight text-white">
              Postoll
            </span>
          </Link>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-sm font-bold text-white md:hidden"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="space-y-1.5" aria-label="Workspace navigation">
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
                className="flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-[15px] font-bold transition"
                style={{
                  background: isActive ? item.activeBg : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--foreground)",
                  border: isActive
                    ? "1px solid rgba(124, 92, 255, 0.45)"
                    : "1px solid transparent",
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: item.iconColor,
                  }}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/settings"
        onClick={onClose}
        className="mt-6 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[15px] font-bold transition hover:bg-white/[0.07]"
        style={{ color: "var(--foreground)" }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base">
          ⚙
        </span>
        <span className="truncate">Settings</span>
      </Link>
    </div>
  );

  return (
    <>
      <aside
        className="hidden w-56 shrink-0 border-r md:block"
        style={{
          background: "#0B0B0F",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        {railContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside
            className="relative z-10 h-full w-64 max-w-[82vw] overflow-y-auto border-r shadow-2xl"
            style={{
              background: "#0B0B0F",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            {railContent}
          </aside>
        </div>
      )}
    </>
  );
}

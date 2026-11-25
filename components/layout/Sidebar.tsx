"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Home", href: "/", icon: "⌂" },
  { name: "Workflows", href: "/workflows", icon: "✦" },
  { name: "Automatic Posting", href: "/automatic-posting", icon: "⟳" },
  { name: "Calendar", href: "/calendar", icon: "◫" },
  { name: "Accounts", href: "/accounts", icon: "◎" },
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
    <div className="flex h-full flex-col justify-between p-5">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              onClick={onClose}
              className="text-xl font-bold tracking-tight"
            >
              Postoll
            </Link>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              AI social media assistant
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg border text-xs lg:hidden"
              style={{ borderColor: "var(--border)" }}
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
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: isActive ? "var(--foreground)" : "transparent",
                  color: isActive ? "var(--background)" : "var(--foreground)",
                }}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className="mt-8 rounded-2xl border p-3.5 text-xs"
        style={{
          borderColor: "var(--border)",
          color: "var(--muted)",
        }}
      >
        <p className="font-semibold" style={{ color: "var(--foreground)" }}>
          Studio Mode Active
        </p>
        <p className="mt-1 leading-relaxed">
          Automated slots and workflows run in the background.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden w-64 shrink-0 border-r lg:block"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        {content}
      </aside>

      {/* Mobile & Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
          />
          <aside
            className="relative z-10 h-full w-72 max-w-[82vw] overflow-y-auto border-r shadow-2xl"
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

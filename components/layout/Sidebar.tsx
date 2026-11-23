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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r p-5"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <div className="mb-8">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Postoll
        </Link>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          AI social media assistant
        </p>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}

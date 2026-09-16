"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Home",
    href: "/",
    icon: "⌂",
  },
  {
    name: "Workflows",
    href: "/workflows",
    icon: "✦",
  },
  {
    name: "Content",
    href: "/content",
    icon: "▣",
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: "□",
  },
  {
    name: "Accounts",
    href: "/accounts",
    icon: "↗",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-64 shrink-0 border-r md:block"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="sticky top-0 flex h-screen flex-col p-6">
        {/* Logo / Home */}
        <div className="mb-10">
          <Link
            href="/"
            className="group inline-block"
            aria-label="Go to Postoll Home"
          >
            <h1 className="text-2xl font-bold tracking-tight transition-opacity group-hover:opacity-75">
              Postoll
            </h1>

            <p
              className="mt-1 text-sm transition-opacity group-hover:opacity-75"
              style={{ color: "var(--muted)" }}
            >
              AI social media assistant
            </p>
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200"
                style={{
                  background: isActive
                    ? "var(--card-hover)"
                    : "transparent",

                  color: isActive
                    ? "var(--foreground)"
                    : "var(--muted)",
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center text-base"
                  style={{
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  {item.icon}
                </span>

                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="mt-auto">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200"
            style={{
              color: pathname.startsWith("/settings")
                ? "var(--foreground)"
                : "var(--muted)",

              background: pathname.startsWith("/settings")
                ? "var(--card-hover)"
                : "transparent",
            }}
          >
            <span className="flex h-6 w-6 items-center justify-center text-base">
              ⚙
            </span>

            <span>Settings</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

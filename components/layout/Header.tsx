"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserProfile = {
  email: string;
  fullName: string;
  credits: number;
  isAdmin: boolean;
};

export default function Header({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [darkMode, setDarkMode] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("postoll-theme");

    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }

    let active = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !active) {
        return;
      }

      const fullName =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Creator";

      let credits = 0;
      let isAdmin = false;

      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("credits, is_admin, full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (typeof prof?.credits === "number") {
          credits = prof.credits;
        }
        isAdmin = Boolean(prof?.is_admin);
        if (active) {
          setProfile({
            email: user.email || "",
            fullName: prof?.full_name || fullName,
            credits,
            isAdmin,
          });
        }
        return;
      } catch {
        // Fallback to auth metadata
      }

      if (active) {
        setProfile({
          email: user.email || "",
          fullName,
          credits,
          isAdmin,
        });
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function toggleTheme() {
    const nextTheme = !darkMode;

    setDarkMode(nextTheme);

    if (nextTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("postoll-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("postoll-theme", "light");
    }
  }

  async function handleLogout() {
    setProfileOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function getInitials(name: string) {
    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-[72px] items-center justify-between gap-3 border-b border-[var(--border)] bg-[rgba(9,9,11,0.88)] px-4 backdrop-blur-xl sm:px-6 md:px-8">
      {/* Left: Mobile Drawer Button + Greeting */}
      <div className="flex min-w-0 items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#7C5CFF]/40 bg-[#7C5CFF]/15 text-base font-bold text-[#C4B5FD] transition hover:bg-[#7C5CFF]/25 lg:hidden"
          >
            ☰
          </button>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white sm:text-base">
            {getGreeting()}
            {profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
          </p>
          <p className="hidden text-xs text-[var(--muted-foreground)] sm:block">
            Create, schedule, and grow across your channels.
          </p>
        </div>
      </div>

      {/* Right: Credits Pill + Create CTA + Theme + Profile */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {profile && (
          <Link
            href="/settings"
            className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 md:inline-flex"
            title="Available studio credits"
          >
            <span>✦</span>
            <span>{profile.credits} Credits</span>
          </Link>
        )}

        <Link
          href="/create"
          className="hidden items-center gap-1.5 rounded-full bg-[#7C5CFF] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6A48F5] sm:inline-flex"
        >
          <span>+ Create</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-base transition hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {darkMode ? "☀" : "☾"}
        </button>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 transition hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
              }}
            >
              {profile ? getInitials(profile.fullName) : "U"}
            </div>

            <div className="hidden text-left md:block">
              <div className="max-w-[140px] truncate text-xs font-bold text-white">
                {profile?.fullName || "User"}
              </div>
              <div className="max-w-[140px] truncate text-[11px] text-[var(--muted-foreground)]">
                {profile?.email || ""}
              </div>
            </div>

            <span
              className={[
                "hidden pr-1 text-xs text-[var(--muted-foreground)] transition-transform md:block",
                profileOpen ? "rotate-180" : "",
              ].join(" ")}
            >
              ⌄
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-13 z-50 w-[290px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[#111113] shadow-2xl shadow-black/50">
              <div className="border-b border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #7C5CFF 0%, #EC4899 100%)",
                    }}
                  >
                    {profile ? getInitials(profile.fullName) : "U"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">
                      {profile?.fullName || "User"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                      {profile?.email || ""}
                    </div>
                    {profile && (
                      <div className="mt-1.5 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                        {profile.credits} Credits available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-2">
                {profile?.isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      router.push("/admin");
                    }}
                    className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[#C4B5FD] transition hover:bg-[#7C5CFF]/15 hover:text-white"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7C5CFF]/20 text-base">
                      ⚡
                    </span>
                    <span>
                      <span className="block font-bold">Admin Control</span>
                      <span className="block text-[11px] text-[var(--muted-foreground)]">
                        CMS, users, costs &amp; logs
                      </span>
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-neutral-200 transition hover:bg-[var(--surface-hover)] hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#38BDF8]/15 text-base text-[#7DD3FC]">
                    ⚙
                  </span>
                  <span>
                    <span className="block font-bold">Profile &amp; Settings</span>
                    <span className="block text-[11px] text-[var(--muted-foreground)]">
                      Schedule slots, timezone &amp; account
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-neutral-300 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-base text-rose-300">
                    ↩
                  </span>
                  <span>
                    <span className="block font-bold">Log out</span>
                    <span className="block text-[11px] text-[var(--muted-foreground)]">
                      Sign out of Postoll
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

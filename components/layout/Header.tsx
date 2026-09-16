"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserProfile = {
  email: string;
  fullName: string;
};

export default function Header() {
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

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const fullName =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";

      setProfile({
        email: user.email || "",
        fullName,
      });
    }

    loadUser();
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

    return (
      words[0][0] + words[words.length - 1][0]
    ).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[var(--border)] bg-[rgba(9,9,11,0.85)] px-5 backdrop-blur-xl md:px-8">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="hidden h-8 w-px bg-[var(--border)] md:block" />

        <div>
          <p className="text-sm font-medium text-white">
            {getGreeting()}
          </p>

          <p className="hidden text-xs text-[var(--muted-foreground)] sm:block">
            Create something great today.
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm transition hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)]"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {darkMode ? "☀" : "☾"}
        </button>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2 rounded-xl border border-transparent p-1 transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-bold text-black shadow-sm">
              {profile ? getInitials(profile.fullName) : "U"}
            </div>

            <div className="hidden text-left sm:block">
              <div className="max-w-[120px] truncate text-xs font-medium text-white">
                {profile?.fullName || "User"}
              </div>

              <div className="max-w-[120px] truncate text-[11px] text-[var(--muted-foreground)]">
                {profile?.email || ""}
              </div>
            </div>

            <span
              className={[
                "hidden text-[var(--muted-foreground)] transition-transform sm:block",
                profileOpen ? "rotate-180" : "",
              ].join(" ")}
            >
              ˅
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-[280px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[#111113] shadow-2xl shadow-black/40">
              {/* Profile header */}
              <div className="border-b border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-black">
                    {profile ? getInitials(profile.fullName) : "U"}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {profile?.fullName || "User"}
                    </div>

                    <div className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                      {profile?.email || ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu */}
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push("/settings");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
                    ⚙
                  </span>

                  <span>
                    <span className="block font-medium">
                      Settings
                    </span>

                    <span className="block text-[11px] text-[var(--muted-foreground)]">
                      Manage your Postoll account
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
                    ↪
                  </span>

                  <span>
                    <span className="block font-medium">
                      Log out
                    </span>

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
"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface ChatMessage {
  id: string;
  role: "robo" | "user";
  text: string;
  links?: string[];
  escalated?: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  "/workflows": "Workflows",
  "/workflows/create": "Create Workflow",
  "/calendar": "Content Calendar",
  "/accounts": "Connected Accounts",
  "/upgrade": "Plans & Upgrade",
  "/create": "Create Studio",
  "/create/post": "New Post",
  "/content": "Content Library",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/automatic-posting": "Automatic Posting",
};

function isAlwaysHiddenRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  const hiddenPrefixes = [
    "/login",
    "/signup",
    "/privacy",
    "/data-deletion",
    "/approve",
    "/admin",
    "/auth",
  ];
  return hiddenPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function ChaarAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const uid = useId().replace(/:/g, "");
  const dims =
    size === "lg"
      ? "h-11 w-11"
      : size === "sm"
      ? "h-8 w-8"
      : "h-10 w-10";

  return (
    <span
      className={`relative inline-flex ${dims} shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/60 bg-[#0B0A14] shadow-[0_0_18px_rgba(124,58,237,0.65)]`}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`aura-${uid}`} cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#1E1338" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0B0A14" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`armor-${uid}`} x1="16" y1="10" x2="48" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B3556" />
            <stop offset="35%" stopColor="#1C192B" />
            <stop offset="100%" stopColor="#0D0B16" />
          </linearGradient>
          <linearGradient id={`helmet-${uid}`} x1="20" y1="9" x2="44" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4C446E" />
            <stop offset="40%" stopColor="#1F1B30" />
            <stop offset="100%" stopColor="#0E0C18" />
          </linearGradient>
          <linearGradient id={`neon-${uid}`} x1="18" y1="22" x2="46" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>

        {/* Deep Obsidian & Violet Aura Backdrop */}
        <circle cx="32" cy="32" r="32" fill={`url(#aura-${uid})`} />

        {/* Shoulders & Chest Armor Bust */}
        <path
          d="M12 58C13.5 47.5 21 42.5 32 42.5C43 42.5 50.5 47.5 52 58H12Z"
          fill={`url(#armor-${uid})`}
          stroke="#7C3AED"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
        {/* Glowing Chest V-Core Trim */}
        <path
          d="M22 45.5L32 52.5L42 45.5M32 52.5V58"
          stroke={`url(#neon-${uid})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Neck */}
        <rect x="27" y="36" width="10" height="8" rx="3" fill="#12101E" />
        <path d="M29 38V43M35 38V43" stroke="#8B5CF6" strokeOpacity="0.6" strokeWidth="1.1" />

        {/* Ear Pods */}
        <rect x="15.5" y="19" width="3.5" height="10" rx="1.75" fill="#231E38" stroke="#8B5CF6" strokeWidth="1" />
        <rect x="45" y="19" width="3.5" height="10" rx="1.75" fill="#231E38" stroke="#8B5CF6" strokeWidth="1" />

        {/* 3D Sculpted Helmet */}
        <path
          d="M18.5 21C18.5 13.5 24.2 8.5 32 8.5C39.8 8.5 45.5 13.5 45.5 21V27.5C45.5 33.8 40.3 38.5 34 38.5H30C23.7 38.5 18.5 33.8 18.5 27.5V21Z"
          fill={`url(#helmet-${uid})`}
          stroke="#A78BFA"
          strokeOpacity="0.65"
          strokeWidth="1.2"
        />

        {/* Forehead Crest Highlight */}
        <path
          d="M25 12.5C27.2 11.2 29.5 10.7 32 10.7C34.5 10.7 36.8 11.2 39 12.5"
          stroke="#DDD6FE"
          strokeOpacity="0.5"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Dark Visor Recess */}
        <rect
          x="21"
          y="19.5"
          width="22"
          height="8.5"
          rx="4.25"
          fill="#07060D"
          stroke="#7C3AED"
          strokeOpacity="0.7"
          strokeWidth="1"
        />

        {/* Glowing Neon-Violet Eyes */}
        <rect x="24" y="22.2" width="6.2" height="3" rx="1.5" fill="#E9D5FF" />
        <rect x="33.8" y="22.2" width="6.2" height="3" rx="1.5" fill="#E9D5FF" />
        <rect x="23.5" y="21.8" width="7.2" height="3.8" rx="1.9" stroke="#A855F7" strokeOpacity="0.75" strokeWidth="1" />
        <rect x="33.3" y="21.8" width="7.2" height="3.8" rx="1.9" stroke="#A855F7" strokeOpacity="0.75" strokeWidth="1" />

        {/* Cheek / Jaw Neon Accent Lines */}
        <path
          d="M21.5 29.5L25.5 34.5M42.5 29.5L38.5 34.5"
          stroke="#8B5CF6"
          strokeOpacity="0.75"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function RoboAssistant() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(pathname !== "/");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "robo",
      text: "Hey there! I'm Chaar. Ask me how to check your calendar, workflows, connected accounts, or plans—and if something isn't working right, I'll flag it for our team.",
      links: ["/calendar", "/workflows", "/accounts", "/upgrade"],
    },
  ]);

  useEffect(() => {
    if (isAlwaysHiddenRoute(pathname)) {
      setIsAuthenticated(false);
      return;
    }
    if (pathname !== "/") {
      setIsAuthenticated(true);
      return;
    }

    let cancelled = false;
    fetch("/api/billing/me", { credentials: "include" })
      .then((res) => {
        if (!cancelled) setIsAuthenticated(res.ok);
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isAlwaysHiddenRoute(pathname) || !isAuthenticated) {
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          currentPath: pathname,
        }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `chaar-${Date.now()}`,
          role: "robo",
          text:
            data.reply ||
            "I couldn't process that just now. Please try again in a moment.",
          links: Array.isArray(data.suggestedLinks) ? data.suggestedLinks : [],
          escalated: Boolean(data.escalated),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `chaar-err-${Date.now()}`,
          role: "robo",
          text: "I ran into a connection hiccup. Please try again in a few seconds.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div
          style={{
            backgroundColor: "#0E0C1A",
            borderColor: "rgba(139, 92, 246, 0.38)",
          }}
          className="mb-3 flex h-[480px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.75),0_0_30px_rgba(124,58,237,0.22)] backdrop-blur-xl"
        >
          {/* Header */}
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.24) 0%, rgba(15,13,29,0.98) 65%)",
              borderBottomColor: "rgba(139, 92, 246, 0.25)",
            }}
            className="flex items-center justify-between border-b px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              <ChaarAvatar size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: "#FFFFFF" }}
                    className="text-sm font-semibold tracking-wide"
                  >
                    Chaar
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
                <div
                  style={{ color: "#C4B5FD" }}
                  className="text-[11px] font-medium"
                >
                  Postoll Studio Copilot &bull; Always Safe
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Chaar"
              style={{ color: "#CBD5E1" }}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs transition hover:border-violet-400/40 hover:bg-violet-500/20 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            style={{ backgroundColor: "#0B0A14" }}
            className="flex-1 space-y-3.5 overflow-y-auto p-4 text-sm"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  style={
                    msg.role === "user"
                      ? {
                          background:
                            "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                          color: "#FFFFFF",
                        }
                      : {
                          backgroundColor: "#161326",
                          borderColor: "rgba(139, 92, 246, 0.26)",
                          color: "#F8FAFC",
                        }
                  }
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                    msg.role === "user" ? "" : "border"
                  }`}
                >
                  {msg.text}
                </div>

                {msg.escalated && (
                  <span
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.16)",
                      borderColor: "rgba(245, 158, 11, 0.4)",
                      color: "#FDE68A",
                    }}
                    className="mt-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                  >
                    Flagged for Postoll support team
                  </span>
                )}

                {msg.links && msg.links.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.links.map((href) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        style={{
                          backgroundColor: "#1D1836",
                          borderColor: "rgba(167, 139, 250, 0.45)",
                          color: "#EDE9FE",
                        }}
                        className="rounded-full border px-3 py-1 text-xs font-medium transition hover:border-violet-400 hover:bg-violet-600/30"
                      >
                        {ROUTE_LABELS[href] || href} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div
                style={{ color: "#A78BFA" }}
                className="flex items-center gap-2 text-xs font-medium"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                <span>Chaar is thinking...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            style={{
              backgroundColor: "#0E0C1A",
              borderTopColor: "rgba(139, 92, 246, 0.25)",
            }}
            className="flex items-center gap-2 border-t p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="Ask Chaar about calendar, accounts, plans..."
              style={{
                backgroundColor: "#161326",
                borderColor: "rgba(139, 92, 246, 0.3)",
                color: "#F8FAFC",
              }}
              className="flex-1 rounded-xl border px-3.5 py-2 text-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
                color: "#FFFFFF",
              }}
              className="rounded-xl px-4 py-2 text-sm font-semibold shadow-[0_0_16px_rgba(124,58,237,0.45)] transition hover:brightness-110 disabled:opacity-45"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Launcher Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background:
            "linear-gradient(135deg, #161326 0%, #241942 55%, #6D28D9 100%)",
          borderColor: "rgba(167, 139, 250, 0.55)",
          color: "#FFFFFF",
        }}
        className="group flex items-center gap-2.5 rounded-full border py-1.5 pl-2 pr-4 text-sm font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_24px_rgba(124,58,237,0.45)] transition hover:scale-[1.02] hover:border-violet-300"
      >
        <ChaarAvatar size="sm" />
        <span className="tracking-wide">
          {open ? "Hide Chaar" : "Ask Chaar"}
        </span>
      </button>
    </div>
  );
}

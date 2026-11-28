"use client";

import React, { useEffect, useState } from "react";
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
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === "lg"
      ? "h-11 w-11"
      : size === "sm"
      ? "h-8 w-8"
      : "h-10 w-10";

  return (
    <span
      className={`relative inline-flex ${dims} shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-400/50 bg-[#0B0A14] shadow-[0_0_16px_rgba(124,58,237,0.55)]`}
    >
      {!imgFailed ? (
        <img
          src="/chaar-avatar.png"
          alt="Chaar"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 40 40"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect width="40" height="40" rx="20" fill="#0B0A14" />
          <path
            d="M20 5V8M12 16C12 11.5817 15.5817 8 20 8C24.4183 8 28 11.5817 28 16V21C28 24.3137 25.3137 27 22 27H18C14.6863 27 12 24.3137 12 21V16Z"
            fill="#181526"
            stroke="#8B5CF6"
            strokeWidth="1.5"
          />
          <rect x="14.5" y="15" width="11" height="5" rx="2.5" fill="#0B0A14" />
          <circle cx="17.5" cy="17.5" r="1.4" fill="#A78BFA" />
          <circle cx="22.5" cy="17.5" r="1.4" fill="#A78BFA" />
          <path
            d="M11 35C11 30.5817 14.5817 28 20 28C25.4183 28 29 30.5817 29 35"
            fill="#181526"
            stroke="#7C3AED"
            strokeWidth="1.5"
          />
        </svg>
      )}
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

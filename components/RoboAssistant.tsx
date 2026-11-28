"use client";

import React, { useState } from "react";
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

function isHiddenRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/") return true;
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

export function RoboAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "robo",
      text: "Hey there! I'm Robo. Ask me how to check your calendar, workflows, connected accounts, or plans—and if something isn't working right, I'll flag it for our team.",
      links: ["/calendar", "/workflows", "/accounts", "/upgrade"],
    },
  ]);

  if (isHiddenRoute(pathname)) {
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-e`,
            role: "robo",
            text:
              data.error ||
              "I couldn't reply right now. Please try again in a moment.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-r`,
            role: "robo",
            text: data.reply,
            links: Array.isArray(data.suggestedLinks) ? data.suggestedLinks : [],
            escalated: Boolean(data.escalated),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-n`,
          role: "robo",
          text: "Network hiccup while reaching Robo. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[430px] w-[340px] sm:w-[370px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold"
              >
                🤖
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight">Robo Helper</div>
                <div className="text-[11px] text-slate-300">
                  Postoll Guide &bull; Always Safe
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Robo Helper"
              className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3.5 text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {msg.text}
                </div>

                {msg.escalated && (
                  <span className="mt-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                    Escalated to our team
                  </span>
                )}

                {msg.links && msg.links.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {msg.links.map((href) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        {ROUTE_LABELS[href] || href} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-500">Robo is thinking...</div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="Ask about calendar, accounts, plans..."
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
      >
        <span aria-hidden="true" className="text-base">
          🤖
        </span>
        <span>{open ? "Hide Robo" : "Ask Robo"}</span>
      </button>
    </div>
  );
}

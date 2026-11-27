"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "../../AppShell";

type ApprovalItem = {
  id: string;
  workflow_name?: string | null;
  title: string | null;
  caption: string | null;
  image_url: string | null;
  platform: string | null;
  type: string | null;
  status: string | null;
  approval_expires_at: string | null;
  tiktok_settings: {
    privacy_level: string;
    allow_comment: boolean;
    allow_duet: boolean;
    allow_stitch: boolean;
    commercial_content: boolean;
    brand_organic: boolean;
    brand_content: boolean;
  };
};

export default function ApproveTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";

  const [item, setItem] = useState<ApprovalItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"approve" | "regenerate" | null>(
    null
  );
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/approvals/action?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Invalid approval link.");
        }
        if (active) {
          setItem(data.item);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load item.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleAction(action: "approve" | "regenerate") {
    if (!token || !item) return;
    try {
      setSubmitting(action);
      setError("");
      setResultMessage("");

      const res = await fetch("/api/approvals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          tiktokSettings: item.tiktok_settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      if (action === "approve") {
        setResultMessage(
          "Approved! This post is now queued and will publish on its scheduled slot."
        );
        setItem({ ...item, status: "queued" });
      } else {
        setResultMessage(
          "Regeneration requested and a fresh 24-hour approval link has been issued."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setSubmitting(null);
    }
  }

  const isVideo = Boolean(
    item?.image_url && /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(item.image_url)
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div
          className="rounded-3xl border p-6 sm:p-8"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#C4B5FD]">
            ✦ Postoll Content Review
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            Approve Scheduled Content
          </h1>

          {loading && (
            <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
              Loading content preview…
            </p>
          )}

          {!loading && error && !item && (
            <div className="mt-6 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          )}

          {!loading && item && (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                  Workflow: {item.workflow_name || "Postoll Workflow"} · Platform:{" "}
                  <span className="uppercase">{item.platform || "multi"}</span>
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  {item.title || "Scheduled Draft"}
                </h2>
              </div>

              {item.image_url && (
                <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                  {isVideo ? (
                    <video
                      src={item.image_url}
                      controls
                      className="max-h-96 w-full bg-black object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.title || "Preview"}
                      className="max-h-96 w-full object-contain"
                    />
                  )}
                </div>
              )}

              {item.caption && (
                <div
                  className="rounded-2xl border p-4 text-sm whitespace-pre-line"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                >
                  {item.caption}
                </div>
              )}

              {/* TikTok Compliance & Interaction Controls */}
              <div
                className="space-y-3 rounded-2xl border p-4 text-xs"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <p className="text-sm font-bold">TikTok Publishing Settings</p>
                <label className="flex flex-col gap-1">
                  <span style={{ color: "var(--muted)" }}>Privacy Level</span>
                  <select
                    value={item.tiktok_settings.privacy_level}
                    onChange={(e) =>
                      setItem({
                        ...item,
                        tiktok_settings: {
                          ...item.tiktok_settings,
                          privacy_level: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl border bg-black/30 px-3 py-2 text-xs text-white"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <option value="PUBLIC_TO_EVERYONE">Public to Everyone</option>
                    <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
                    <option value="FOLLOWER_OF_CREATOR">Followers</option>
                    <option value="SELF_ONLY">Only Me (Private)</option>
                  </select>
                </label>

                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {(
                    [
                      ["allow_comment", "Allow Comments"],
                      ["allow_duet", "Allow Duet"],
                      ["allow_stitch", "Allow Stitch"],
                      ["commercial_content", "Commercial Content Disclosure"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(item.tiktok_settings[key])}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            tiktok_settings: {
                              ...item.tiktok_settings,
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {resultMessage && (
                <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  {resultMessage}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  disabled={Boolean(submitting)}
                  onClick={() => handleAction("approve")}
                  className="rounded-xl bg-[#7C5CFF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:opacity-50"
                >
                  {submitting === "approve" ? "Approving…" : "Approve & Queue"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(submitting)}
                  onClick={() => handleAction("regenerate")}
                  className="rounded-xl border px-6 py-3 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: "var(--border)" }}
                >
                  {submitting === "regenerate"
                    ? "Requesting…"
                    : "Regenerate Draft"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../../AppShell";
import { useWorkflow } from "../context";

type ConnectedAccount = {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  connected: boolean;
};

const PLATFORM_META: Record<
  string,
  { name: string; icon: string; description: string }
> = {
  instagram: {
    name: "Instagram",
    icon: "📸",
    description: "Post reels, images and captions automatically.",
  },
  facebook: {
    name: "Facebook",
    icon: "📘",
    description: "Publish content to your Facebook pages.",
  },
  linkedin: {
    name: "LinkedIn",
    icon: "💼",
    description: "Share professional content automatically.",
  },
  twitter: {
    name: "X / Twitter",
    icon: "𝕏",
    description: "Publish updates and threads.",
  },
};

export default function AccountsPage() {
  const router = useRouter();
  const { workflow, updateWorkflow } = useWorkflow();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load connected accounts
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/accounts");
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load accounts");
        }

        if (!cancelled) {
          setAccounts(Array.isArray(data) ? data : data?.accounts ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to load connected accounts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group accounts by platform
  const accountsByPlatform = accounts.reduce<
    Record<string, ConnectedAccount[]>
  >((acc, a) => {
    if (!a.connected) return acc;
    const key = a.platform.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  function isSelected(accountId: string) {
    return (workflow.selectedAccounts || []).some(
      (a) => a.accountId === accountId
    );
  }

  function toggleAccount(account: ConnectedAccount) {
    const current = workflow.selectedAccounts || [];
    const already = current.find((a) => a.accountId === account.id);

    let next: typeof current;

    if (already) {
      // deselect
      next = current.filter((a) => a.accountId !== account.id);
    } else {
      // select (for now allow only one account per platform)
      next = [
        ...current.filter(
          (a) => a.platform !== account.platform.toLowerCase()
        ),
        {
          platform: account.platform.toLowerCase(),
          accountId: account.id,
          accountName: account.account_name || account.account_id,
          platformAccountId: account.account_id,
        },
      ];
    }

    // also keep the platforms[] array in sync
    const platforms = Array.from(
      new Set(next.map((a) => a.platform))
    );

    updateWorkflow({
      selectedAccounts: next,
      platforms,
    });
  }

  async function connectInstagram() {
    try {
      // remember that we came from the workflow builder
      sessionStorage.setItem("postoll_return_to_workflow", "1");

      const res = await fetch("/api/accounts/instagram/connect", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data?.authorizationUrl) {
        throw new Error(data?.error || "Could not start Instagram connect");
      }

      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setError(err?.message || "Failed to start Instagram connection");
    }
  }

  const canContinue = (workflow.selectedAccounts || []).length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
        {/* HEADER */}
        <div className="mb-10">
          <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>
            ✦ Workflow Builder
          </p>
          <h1 className="mt-2 text-4xl font-bold">Connect Social Accounts</h1>
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            Choose which connected accounts this workflow should publish to.
          </p>
        </div>

        {/* MAIN CARD */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <h2 className="text-xl font-semibold">Select Accounts</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Only accounts you have already connected are shown. You can connect
            more below.
          </p>

          {loading && (
            <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>
              Loading connected accounts…
            </p>
          )}

          {error && (
            <div
              className="mt-6 rounded-xl border p-4 text-sm"
              style={{
                borderColor: "rgba(239,68,68,.3)",
                background: "rgba(239,68,68,.1)",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          {!loading && (
            <div className="mt-8 space-y-8">
              {Object.keys(PLATFORM_META).map((platformId) => {
                const meta = PLATFORM_META[platformId];
                const platformAccounts = accountsByPlatform[platformId] || [];

                return (
                  <div key={platformId}>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{meta.icon}</span>
                        <div>
                          <h3 className="font-semibold">{meta.name}</h3>
                          <p
                            className="text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      {platformId === "instagram" && (
                        <button
                          type="button"
                          onClick={connectInstagram}
                          className="rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-white/5"
                          style={{ borderColor: "var(--border)" }}
                        >
                          + Connect another
                        </button>
                      )}
                    </div>

                    {platformAccounts.length === 0 ? (
                      <div
                        className="rounded-xl border border-dashed p-5 text-sm"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--muted)",
                        }}
                      >
                        No {meta.name} accounts connected yet.
                        {platformId === "instagram" && (
                          <button
                            type="button"
                            onClick={connectInstagram}
                            className="ml-2 font-medium underline"
                            style={{ color: "#a78bfa" }}
                          >
                            Connect Instagram
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {platformAccounts.map((acc) => {
                          const selected = isSelected(acc.id);
                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => toggleAccount(acc)}
                              className="rounded-2xl border p-5 text-left transition hover:-translate-y-0.5"
                              style={{
                                background: selected
                                  ? "rgba(139,92,246,.12)"
                                  : "var(--background)",
                                borderColor: selected
                                  ? "#8b5cf6"
                                  : "var(--border)",
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {acc.account_name || acc.account_id}
                                  </p>
                                  <p
                                    className="mt-1 text-xs"
                                    style={{ color: "var(--muted)" }}
                                  >
                                    {acc.account_id}
                                  </p>
                                </div>
                                <span className="text-sm">
                                  {selected ? "✓" : "+"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* BUTTONS */}
          <div
            className="mt-10 flex justify-between border-t pt-6"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border px-6 py-3"
            >
              ← Back
            </button>

            <button
              type="button"
              disabled={!canContinue}
              onClick={() => router.push("/workflows/create/approval")}
              className="rounded-xl px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
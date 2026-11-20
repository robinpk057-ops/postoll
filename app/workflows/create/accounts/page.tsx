"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkflow } from "../context";
import { createClient } from "@/lib/supabase/client";

type ConnectedAccount = {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  connected?: boolean | null;
};

const PLATFORM_STYLES: Record<
  string,
  { badge: string; badgeClass: string; selectedCardClass: string }
> = {
  instagram: {
    badge: "IG",
    badgeClass: "from-pink-500/20 to-amber-500/20 text-pink-300 border-pink-500/30",
    selectedCardClass: "border-pink-500/50 bg-pink-500/[0.07]",
  },
  facebook: {
    badge: "FB",
    badgeClass: "from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30",
    selectedCardClass: "border-blue-500/50 bg-blue-500/[0.07]",
  },
  youtube: {
    badge: "YT",
    badgeClass: "from-red-500/20 to-rose-500/20 text-red-300 border-red-500/30",
    selectedCardClass: "border-red-500/50 bg-red-500/[0.07]",
  },
  linkedin: {
    badge: "IN",
    badgeClass: "from-sky-500/20 to-cyan-500/20 text-sky-300 border-sky-500/30",
    selectedCardClass: "border-sky-500/50 bg-sky-500/[0.07]",
  },
  x: {
    badge: "X",
    badgeClass: "from-zinc-500/25 to-neutral-500/25 text-zinc-200 border-zinc-500/40",
    selectedCardClass: "border-zinc-400/50 bg-zinc-500/[0.09]",
  },
  tiktok: {
    badge: "TT",
    badgeClass: "from-cyan-500/20 to-fuchsia-500/20 text-cyan-200 border-cyan-500/30",
    selectedCardClass: "border-cyan-400/50 bg-cyan-500/[0.07]",
  },
};

export default function WorkflowAccountsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { workflow, updateWorkflow } = useWorkflow();

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedAccounts, setSelectedAccounts] = useState<
    { platform: string; accountId: string; accountName: string; platformAccountId: string }[]
  >(workflow.selectedAccounts || []);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("accounts")
          .select("id, platform, account_id, account_name, connected")
          .eq("user_id", user.id);

        if (fetchError) throw fetchError;
        setAccounts((data || []).filter((acc) => acc.connected !== false));
      } catch (err: any) {
        console.error("Failed to load connected accounts:", err);
        setError("Could not load your connected social accounts.");
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [router, supabase]);

  const toggleAccount = (acc: ConnectedAccount) => {
    setError("");
    setSelectedAccounts((prev) => {
      const exists = prev.some((item) => item.accountId === acc.id);

      if (exists) {
        return prev.filter((item) => item.accountId !== acc.id);
      } else {
        return [
          ...prev,
          {
            platform: acc.platform.toLowerCase(),
            accountId: acc.id,
            accountName: acc.account_name || "Account",
            platformAccountId: acc.account_id,
          },
        ];
      }
    });
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAccounts.length === 0) {
      setError("Please select at least one connected account for this workflow.");
      return;
    }

    const activePlatforms = Array.from(new Set(selectedAccounts.map((a) => a.platform)));

    updateWorkflow({
      selectedAccounts,
      platforms: activePlatforms,
    });

    router.push("/workflows/create/approval");
  };

  const platformsList = ["instagram", "facebook", "youtube", "linkedin", "x", "tiktok"];

  const formatPlatformName = (platform: string) => {
    if (platform === "tiktok") return "TikTok";
    if (platform === "youtube") return "YouTube";
    if (platform === "linkedin") return "LinkedIn";
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header + Selection Summary */}
      <div className="mb-8 flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            Workflow Setup &middot; Channels
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Select Target Accounts
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Choose which connected social media accounts will publish content for this workflow.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 text-xs font-medium text-zinc-200">
            <span
              className={`h-2 w-2 rounded-full ${
                selectedAccounts.length > 0 ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <span>
              {selectedAccounts.length}{" "}
              {selectedAccounts.length === 1 ? "account" : "accounts"} selected
            </span>
          </div>

          {selectedAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAccounts([])}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {platformsList.map((platform) => (
            <div
              key={platform}
              className="h-32 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5"
            />
          ))}
        </div>
      ) : (
        <form onSubmit={handleNext} className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {platformsList.map((platform) => {
              const platformAccounts = accounts.filter(
                (acc) => acc.platform.toLowerCase() === platform
              );
              const hasAccounts = platformAccounts.length > 0;
              const style = PLATFORM_STYLES[platform] || PLATFORM_STYLES.x;

              return (
                <div
                  key={platform}
                  className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                    hasAccounts
                      ? "border-zinc-800/90 bg-zinc-950/90 shadow-sm hover:border-zinc-700/90"
                      : "border-zinc-900 bg-zinc-950/45"
                  }`}
                >
                  {/* Platform Card Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-gradient-to-br text-xs font-bold tracking-wider ${style.badgeClass}`}
                      >
                        {style.badge}
                      </div>
                      <h3 className="text-base font-semibold text-zinc-100">
                        {formatPlatformName(platform)}
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        hasAccounts
                          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : "border border-zinc-800 bg-zinc-900/90 text-zinc-500"
                      }`}
                    >
                      {platformAccounts.length} connected
                    </span>
                  </div>

                  {/* Platform Card Body */}
                  {!hasAccounts ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-800/90 bg-zinc-900/30 px-3.5 py-3">
                      <span className="text-xs text-zinc-500">
                        No {formatPlatformName(platform)} accounts connected yet.
                      </span>
                      <a
                        href="/accounts"
                        className="shrink-0 text-xs font-medium text-zinc-200 transition hover:text-white hover:underline"
                      >
                        Connect account &rarr;
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {platformAccounts.map((acc) => {
                        const isSelected = selectedAccounts.some(
                          (item) => item.accountId === acc.id
                        );

                        return (
                          <button
                            key={acc.id}
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            onClick={() => toggleAccount(acc)}
                            className={`group flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all ${
                              isSelected
                                ? `${style.selectedCardClass} shadow-sm`
                                : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                  isSelected
                                    ? "border-emerald-400 bg-emerald-400 text-zinc-950"
                                    : "border-zinc-600 bg-zinc-950 group-hover:border-zinc-400"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="h-3 w-3 stroke-[3]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </span>

                              <span className="truncate text-sm font-medium text-zinc-100">
                                {acc.account_name || `Account ID: ${acc.account_id}`}
                              </span>
                            </div>

                            <span className="ml-3 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/90 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Ready
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between border-t border-zinc-800/80 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
            >
              Back
            </button>

            <button
              type="submit"
              disabled={selectedAccounts.length === 0}
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to Approval &rarr;
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
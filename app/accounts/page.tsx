"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "../AppShell";

type PlatformId =
  | "instagram"
  | "facebook"
  | "youtube"
  | "linkedin"
  | "x"
  | "tiktok";

type Platform = {
  id: PlatformId;
  name: string;
  description: string;
  accentGradient: string;
  badgeText: string;
};

type ConnectedAccount = {
  id: string;
  platform: PlatformId;
  account_name: string;
  account_id: string;
  connected: boolean;
};

const platforms: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    description:
      "Publish posts and Reels directly to your Instagram account.",
    accentGradient: "from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    badgeText: "Reels & Posts",
  },
  {
    id: "facebook",
    name: "Facebook",
    description:
      "Publish posts and videos to your Facebook Page.",
    accentGradient: "from-[#1877F2] to-[#0C52B5]",
    badgeText: "Pages & Video",
  },
  {
    id: "youtube",
    name: "YouTube",
    description:
      "Publish videos and Shorts directly to your YouTube channel.",
    accentGradient: "from-[#FF0000] to-[#B91C1C]",
    badgeText: "Shorts & Video",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Publish professional content to your LinkedIn profile or Page.",
    accentGradient: "from-[#0A66C2] to-[#004182]",
    badgeText: "Profile & Page",
  },
  {
    id: "x",
    name: "X",
    description:
      "Publish text, images and supported media to X.",
    accentGradient: "from-[#27272A] to-[#09090B]",
    badgeText: "Posts & Media",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description:
      "Publish short-form videos directly to your TikTok account.",
    accentGradient: "from-[#00F2FE] via-[#111827] to-[#FE2C55]",
    badgeText: "Short Video",
  },
];

function BrandIcon({ platformId }: { platformId: PlatformId }) {
  switch (platformId) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
          <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.6v3.2h2.8V21h3.1z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28.4 28.4 0 0 0 2 12a28.4 28.4 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28.4 28.4 0 0 0 22 12a28.4 28.4 0 0 0-.4-4.8zM10 15.2V8.8l5.5 3.2-5.5 3.2z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
          <path d="M6.9 8.5H3.8V19h3.1V8.5zM5.3 4a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 5.3 4zM20.2 12.9c0-2.8-1.5-4.3-3.8-4.3-1.7 0-2.5.9-2.9 1.6V8.5h-3V19h3.1v-5.5c0-1.5.3-2.9 2.1-2.9s1.8 1.6 1.8 3V19h3v-6.1z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
          <path d="M18.2 3h3.1l-6.8 7.8L22.5 21h-6.3l-4.9-6.4L5.7 21H2.6l7.3-8.4L2 3h6.4l4.4 5.8L18.2 3zm-1.1 16.1h1.7L7.5 4.8H5.7l11.4 14.3z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
        </svg>
      );
  }
}

function AccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<PlatformId | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const connectedParam = searchParams.get("connected");
    const errorParam = searchParams.get("error");
    if (connectedParam) {
      setMessage(`Successfully connected ${connectedParam} account!`);
    }
    if (errorParam) {
      setError(`Connection error: ${errorParam}`);
    }
    loadAccounts();
  }, [searchParams]);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/accounts", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load connected accounts."
        );
      }

      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("Load accounts error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load connected accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startOAuthConnect(
    platformId: Exclude<PlatformId, "x">,
    endpoint: string,
    defaultErr: string
  ) {
    try {
      setConnecting(platformId);
      setError("");
      setMessage("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || defaultErr);
      }

      if (!data.authorizationUrl) {
        throw new Error("Authorization URL was not returned.");
      }

      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : defaultErr
      );
      setConnecting(null);
    }
  }

  function handleConnect(platformId: PlatformId) {
    if (platformId === "instagram") {
      return startOAuthConnect("instagram", "/api/accounts/instagram/connect", "Unable to connect Instagram.");
    }
    if (platformId === "facebook") {
      return startOAuthConnect("facebook", "/api/accounts/facebook/connect", "Facebook connect failed.");
    }
    if (platformId === "youtube") {
      return startOAuthConnect("youtube", "/api/accounts/youtube/connect", "YouTube connect failed.");
    }
    if (platformId === "linkedin") {
      return startOAuthConnect("linkedin", "/api/accounts/linkedin/connect", "LinkedIn connect failed.");
    }
    if (platformId === "tiktok") {
      return startOAuthConnect("tiktok", "/api/accounts/tiktok/connect", "TikTok connect failed.");
    }

    setError(`${platformId} connection is not implemented yet.`);
    setMessage("");
  }

  async function handleDisconnect(account: ConnectedAccount) {
    try {
      setDisconnecting(account.id);
      setError("");
      setMessage("");

      const response = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to disconnect account.");
      }

      setMessage(`${account.account_name} has been disconnected.`);
      await loadAccounts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to disconnect account."
      );
    } finally {
      setDisconnecting(null);
    }
  }

  function getAccount(platformId: PlatformId) {
    return accounts.find(
      (account) => account.platform === platformId
    );
  }

  if (!mounted) {
    return null;
  }

  const connectedCount = accounts.filter((acc) => acc.connected).length;

  return (
    <AppShell>
      <div className="mx-auto w-full w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* HEADER */}
        <div className="mb-8 rounded-3xl border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,92,255,0.16) 0%, var(--card) 55%, rgba(16,185,129,0.12) 100%)",
            borderColor: "var(--border)",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#C4B5FD]">
            ✦ Postoll Connected Channels
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Social Accounts
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "var(--muted)" }}>
            Connect your social media accounts once. Postoll uses them when publishing or scheduling your workflows and reels.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-4 py-1.5 text-xs font-bold text-emerald-300">
              {loading
                ? "Checking connections..."
                : `${connectedCount} of ${platforms.length} channels active`}
            </span>
          </div>
        </div>

        {/* SUCCESS */}
        {message && (
          <div
            className="mb-6 rounded-2xl border p-4 text-sm"
            style={{
              borderColor: "rgba(34,197,94,.35)",
              background: "rgba(34,197,94,.08)",
              color: "#4ade80",
            }}
          >
            {message}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div
            className="mb-6 rounded-2xl border p-4 text-sm"
            style={{
              borderColor: "rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.08)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {/* PLATFORM CARDS */}
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => {
            const account = getAccount(platform.id);
            const isConnected = Boolean(account);
            const isConnecting = connecting === platform.id;
            const isDisconnecting = disconnecting === account?.id;

            return (
              <div
                key={platform.id}
                className="flex flex-col justify-between rounded-2xl border p-6 transition hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  borderColor: isConnected
                    ? "rgba(34,197,94,.4)"
                    : "var(--border)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${platform.accentGradient} shadow-md`}
                  >
                    <BrandIcon platformId={platform.id} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold">{platform.name}</h2>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300">
                        {platform.badgeText}
                      </span>
                      {isConnected && (
                        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                          Connected
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-1.5 text-sm leading-6"
                      style={{ color: "var(--muted)" }}
                    >
                      {platform.description}
                    </p>

                    {isConnected && account && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5">
                        <p className="text-sm font-bold text-white">
                          {account.account_name}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          Account ID: {account.account_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  {isConnected && account ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(account)}
                      disabled={Boolean(disconnecting)}
                      className="w-full rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnect(platform.id)}
                      disabled={Boolean(connecting)}
                      className="w-full rounded-xl bg-[#7C5CFF] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#6A48F5] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsContent />
    </Suspense>
  );
}

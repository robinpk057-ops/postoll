"use client";

import { useEffect, useState } from "react";
import AppShell from "../AppShell";

type PlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x";

type Platform = {
  id: PlatformId;
  name: string;
  description: string;
  icon: string;
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
    icon: "📸",
  },
  {
    id: "facebook",
    name: "Facebook",
    description:
      "Publish posts and videos to your Facebook Page.",
    icon: "f",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Publish professional content to your LinkedIn profile or Page.",
    icon: "in",
  },
  {
    id: "x",
    name: "X",
    description:
      "Publish text, images and supported media to X.",
    icon: "𝕏",
  },
];

/*
|--------------------------------------------------------------------------
| TEMPORARY INSTAGRAM TEST CONTENT
|--------------------------------------------------------------------------
|
| This is ONLY for testing the Instagram publishing API.
|
| After the first successful publication, this section will be removed
| and publishing will be connected to the normal Postoll workflow.
|
*/

const TEST_CONTENT_ID =
  "46305625-e2cf-44de-94d6-3836924852b4";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<
    ConnectedAccount[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [connecting, setConnecting] =
    useState<PlatformId | null>(null);

  const [disconnecting, setDisconnecting] =
    useState<string | null>(null);

  const [publishing, setPublishing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [publishResult, setPublishResult] =
    useState<string>("");

  /*
  |--------------------------------------------------------------------------
  | LOAD CONNECTED ACCOUNTS
  |--------------------------------------------------------------------------
  */

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/accounts",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load connected accounts."
        );
      }

      setAccounts(
        data.accounts || []
      );
    } catch (err) {
      console.error(
        "Load accounts error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load connected accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadAccounts();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | CONNECT INSTAGRAM
  |--------------------------------------------------------------------------
  */

  async function connectInstagram() {
    try {
      setConnecting("instagram");
  
      setError("");
      setMessage("");
      setPublishResult("");
  
      const response = await fetch(
        "/api/accounts/instagram/connect",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
  
      const data =
        await response.json();
  
      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to start Instagram connection."
        );
      }
  
      if (
        !data.authorizationUrl
      ) {
        throw new Error(
          "Instagram authorization URL was not returned."
        );
      }
  
      window.location.href =
        data.authorizationUrl;
    } catch (err) {
      console.error(
        "Instagram connection error:",
        err
      );
  
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect Instagram."
      );
  
      setConnecting(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CONNECT OTHER PLATFORMS
  |--------------------------------------------------------------------------
  */

  function handleConnect(
    platformId: PlatformId
  ) {
    if (
      platformId === "instagram"
    ) {
      connectInstagram();
      return;
    }

    setError(
      `${platformId} connection is not implemented yet.`
    );

    setMessage("");
    setPublishResult("");
  }

  /*
  |--------------------------------------------------------------------------
  | DISCONNECT ACCOUNT
  |--------------------------------------------------------------------------
  */

  async function handleDisconnect(
    account: ConnectedAccount
  ) {
    try {
      setDisconnecting(account.id);

      setError("");
      setMessage("");
      setPublishResult("");

      const response = await fetch(
        "/api/accounts",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: account.id,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to disconnect account."
        );
      }

      setMessage(
        `${account.account_name} has been disconnected.`
      );

      await loadAccounts();
    } catch (err) {
      console.error(
        "Disconnect account error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect account."
      );
    } finally {
      setDisconnecting(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | TEMPORARY INSTAGRAM PUBLISH TEST
  |--------------------------------------------------------------------------
  |
  | This sends ONLY the content ID.
  |
  | The server then:
  |
  | 1. Loads the content from Supabase.
  | 2. Verifies ownership.
  | 3. Gets the public image URL.
  | 4. Gets the connected Instagram account.
  | 5. Creates the Instagram media container.
  | 6. Publishes the media.
  |
  | The Instagram access token never reaches the browser.
  |--------------------------------------------------------------------------
  */

  async function testInstagramPublish() {
    try {
      setPublishing(true);

      setError("");
      setMessage("");
      setPublishResult("");

      const response = await fetch(
        "/api/publish/instagram",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            contentId:
              TEST_CONTENT_ID,
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "Instagram publish response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to publish to Instagram."
        );
      }

      const mediaId =
        data.publication?.media_id ||
        "unknown";

      setPublishResult(
        `Instagram publication successful. Media ID: ${mediaId}`
      );

      setMessage(
        "Your Postoll test content was successfully published to Instagram."
      );
    } catch (err) {
      console.error(
        "Instagram publish test error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish to Instagram."
      );
    } finally {
      setPublishing(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | HELPERS
  |--------------------------------------------------------------------------
  */

  function getAccount(
    platformId: PlatformId
  ) {
    return accounts.find(
      (account) =>
        account.platform ===
          platformId &&
        account.connected
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  const instagramAccount =
    getAccount("instagram");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">

        {/* HEADER */}

        <div className="mb-10">
          <p
            className="text-sm font-medium"
            style={{
              color: "#a78bfa",
            }}
          >
            ✦ Postoll Accounts
          </p>

          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Accounts
          </h1>

          <p
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{
              color: "var(--muted)",
            }}
          >
            Connect your social media accounts once.
            Postoll will use them when publishing or
            scheduling your content.
          </p>
        </div>

        {/* SUCCESS */}

        {message && (
          <div
            className="mb-6 rounded-2xl border p-4 text-sm"
            style={{
              borderColor:
                "rgba(34,197,94,.35)",
              background:
                "rgba(34,197,94,.08)",
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
              borderColor:
                "rgba(239,68,68,.35)",
              background:
                "rgba(239,68,68,.08)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {/* TEMPORARY INSTAGRAM TEST */}

        {instagramAccount && (
          <div
            className="mb-8 rounded-2xl border p-6"
            style={{
              background: "var(--card)",
              borderColor:
                "rgba(167,139,250,.35)",
            }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: "#a78bfa",
                  }}
                >
                  Temporary Test
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Test Instagram Publishing
                </h2>

                <p
                  className="mt-2 max-w-2xl text-sm leading-6"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Publish the saved Postoll test image
                  to the connected Instagram account{" "}
                  <strong
                    style={{
                      color:
                        "var(--foreground)",
                    }}
                  >
                    {instagramAccount.account_name}
                  </strong>
                  .
                </p>

                <p
                  className="mt-2 text-xs"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Content ID:{" "}
                  {TEST_CONTENT_ID}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  testInstagramPublish
                }
                disabled={publishing}
                className="w-full shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                style={{
                  background:
                    "var(--foreground)",
                  color:
                    "var(--background)",
                }}
              >
                {publishing
                  ? "Publishing..."
                  : "Test Publish"}
              </button>
            </div>

            {publishResult && (
              <div
                className="mt-5 rounded-xl border p-4 text-sm"
                style={{
                  borderColor:
                    "rgba(34,197,94,.35)",
                  background:
                    "rgba(34,197,94,.06)",
                  color: "#4ade80",
                }}
              >
                {publishResult}
              </div>
            )}

            <div
              className="mt-5 rounded-xl border p-4 text-xs leading-5"
              style={{
                borderColor:
                  "var(--border)",
                color: "var(--muted)",
              }}
            >
              <strong
                style={{
                  color:
                    "var(--foreground)",
                }}
              >
                Test only:
              </strong>{" "}
              This button publishes the specific saved
              content record above. It is temporary and
              will be removed after we confirm Instagram
              publishing works.
            </div>
          </div>
        )}

        {/* CONNECTED SUMMARY */}

        <div
          className="mb-8 rounded-2xl border p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-medium">
                Connected accounts
              </p>

              <p
                className="mt-1 text-sm"
                style={{
                  color: "var(--muted)",
                }}
              >
                {loading
                  ? "Checking connections..."
                  : `${
                      accounts.filter(
                        (account) =>
                          account.connected
                      ).length
                    } of ${
                      platforms.length
                    } accounts connected`}
              </p>
            </div>

            <div className="flex gap-2">
              {platforms.map(
                (platform) => {
                  const account =
                    getAccount(
                      platform.id
                    );

                  if (!account) {
                    return null;
                  }

                  return (
                    <div
                      key={
                        platform.id
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        borderColor:
                          "var(--border)",
                        background:
                          "var(--card-hover)",
                      }}
                      title={
                        account.account_name
                      }
                    >
                      {
                        platform.icon
                      }
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* PLATFORM CARDS */}

        <div className="space-y-4">

          {platforms.map(
            (platform) => {
              const account =
                getAccount(
                  platform.id
                );

              const isConnected =
                Boolean(account);

              const isConnecting =
                connecting ===
                platform.id;

              const isDisconnecting =
                disconnecting ===
                account?.id;

              return (
                <div
                  key={platform.id}
                  className="rounded-2xl border p-6 transition"
                  style={{
                    background:
                      "var(--card)",
                    borderColor:
                      isConnected
                        ? "rgba(34,197,94,.35)"
                        : "var(--border)",
                  }}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                    {/* PLATFORM INFO */}

                    <div className="flex items-start gap-4">

                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-xl font-bold"
                        style={{
                          borderColor:
                            "var(--border)",
                          background:
                            "var(--card-hover)",
                        }}
                      >
                        {
                          platform.icon
                        }
                      </div>

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <h2 className="text-lg font-semibold">
                            {
                              platform.name
                            }
                          </h2>

                          {isConnected && (
                            <span
                              className="rounded-full border px-2.5 py-1 text-xs font-medium"
                              style={{
                                borderColor:
                                  "rgba(34,197,94,.3)",
                                color:
                                  "#4ade80",
                              }}
                            >
                              Connected
                            </span>
                          )}

                        </div>

                        <p
                          className="mt-1 max-w-xl text-sm leading-6"
                          style={{
                            color:
                              "var(--muted)",
                          }}
                        >
                          {
                            platform.description
                          }
                        </p>

                        {isConnected &&
                          account && (
                            <div className="mt-3">

                              <p className="text-sm font-medium">
                                {
                                  account.account_name
                                }
                              </p>

                              <p
                                className="mt-1 text-xs"
                                style={{
                                  color:
                                    "var(--muted)",
                                }}
                              >
                                Account ID:{" "}
                                {
                                  account.account_id
                                }
                              </p>

                            </div>
                          )}

                      </div>
                    </div>

                    {/* ACTION */}

                    <div className="shrink-0">

                      {isConnected &&
                      account ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleDisconnect(
                              account
                            )
                          }
                          disabled={
                            Boolean(
                              disconnecting
                            )
                          }
                          className="w-full rounded-xl border px-5 py-3 text-sm font-medium transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10 sm:w-auto"
                          style={{
                            borderColor:
                              "var(--border)",
                          }}
                        >
                          {isDisconnecting
                            ? "Disconnecting..."
                            : "Disconnect"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleConnect(
                              platform.id
                            )
                          }
                          disabled={
                            Boolean(
                              connecting
                            )
                          }
                          className="w-full rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          style={{
                            background:
                              "var(--foreground)",
                            color:
                              "var(--background)",
                          }}
                        >
                          {isConnecting
                            ? "Connecting..."
                            : "Connect"}
                        </button>
                      )}

                    </div>

                  </div>
                </div>
              );
            }
          )}

        </div>

        {/* SECURITY */}

        <div
          className="mt-8 rounded-2xl border p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex gap-4">

            <div className="text-xl">
              🔒
            </div>

            <div>

              <h3 className="font-semibold">
                Your accounts stay yours
              </h3>

              <p
                className="mt-2 text-sm leading-6"
                style={{
                  color: "var(--muted)",
                }}
              >
                Postoll only stores the
                credentials required to connect
                your social accounts. Your
                credentials are never displayed
                in the browser.
              </p>

            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
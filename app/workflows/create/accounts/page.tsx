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
  connected: boolean;
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("accounts")
          .select("id, platform, account_id, account_name, connected")
          .eq("user_id", user.id)
          .eq("connected", true);

        if (fetchError) throw fetchError;
        setAccounts(data || []);
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

  // Added "youtube" here to support rendering and selection
  const platformsList = ["instagram", "facebook", "youtube", "linkedin", "x"];

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Select Target Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which connected social media accounts will publish content for this workflow.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading your connected accounts...
        </div>
      ) : (
        <form onSubmit={handleNext} className="space-y-6">
          {platformsList.map((platform) => {
            const platformAccounts = accounts.filter(
              (acc) => acc.platform.toLowerCase() === platform
            );

            return (
              <div key={platform} className="rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold capitalize text-base">{platform}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {platformAccounts.length} connected
                  </span>
                </div>

                {platformAccounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground flex items-center justify-between py-2">
                    <span>No {platform} accounts connected yet.</span>
                    <a
                      href="/accounts"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Connect account &rarr;
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {platformAccounts.map((acc) => {
                      const isSelected = selectedAccounts.some((item) => item.accountId === acc.id);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => toggleAccount(acc)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} 
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-medium">
                              {acc.account_name || `Account ID: ${acc.account_id}`}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">Ready</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border px-6 py-3 text-sm font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              Back
            </button>
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
            >
              Continue to Approval &rarr;
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
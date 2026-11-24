"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getPasswordChecklist,
  validateEmailAddress,
  validateStrongPassword,
} from "@/lib/security";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot" | "update">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const newPwChecks = getPasswordChecklist(newPassword);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qMode = params.get("mode");
    if (qMode === "forgot" || qMode === "update") {
      setMode(qMode);
    }

    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const check = validateEmailAddress(email);
    if (!check.valid) {
      setErrorMsg(check.error || "Enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not configured.");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const check = validateEmailAddress(email);
    if (!check.valid) {
      setErrorMsg(check.error || "Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not configured.");

      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${origin}/login?mode=update`,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMsg(
        "Password reset link sent! Check your inbox/spam folder. If email delivery is delayed or rate-limited in Supabase, you can also sign in and use Update Password."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const pwCheck = validateStrongPassword(newPassword);
    if (!pwCheck.valid) {
      setErrorMsg(pwCheck.error || "New password does not meet security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation password do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not configured.");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "No active or recovery session found. Open the reset link from your email or sign in first to update your password."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setNewPassword("");
      setConfirmPassword("");
      setSuccessMsg("Password updated successfully! You can now continue to your dashboard.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/15 bg-[#0c0c0c] p-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "login"
              ? "Sign in to Postoll"
              : mode === "forgot"
              ? "Forgot password"
              : "Update password"}
          </h1>
          <p className="text-sm text-neutral-400">
            {mode === "login"
              ? "Access your workflows, credits, and scheduled posts."
              : mode === "forgot"
              ? "Request a password recovery link for your account."
              : "Set a new password for your account."}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/15 bg-[#141414] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`rounded-lg py-2 transition-colors ${
              mode === "login" ? "bg-white text-black" : "text-neutral-300 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`rounded-lg py-2 transition-colors ${
              mode === "forgot" ? "bg-white text-black" : "text-neutral-300 hover:text-white"
            }`}
          >
            Forgot PW
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("update");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`rounded-lg py-2 transition-colors ${
              mode === "update" ? "bg-white text-black" : "text-neutral-300 hover:text-white"
            }`}
          >
            Update PW
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3.5 text-sm text-emerald-200">
            {successMsg}
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-200">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-neutral-200">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-neutral-300 underline hover:text-white"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-200">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Sending reset link..." : "Send password reset link"}
            </button>
          </form>
        )}

        {mode === "update" && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-200">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
              />
              <ul className="space-y-1 pt-1.5 text-xs">
                <li
                  className={`flex items-center gap-2 ${
                    newPwChecks.minLength ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{newPwChecks.minLength ? "✓" : "○"}</span>
                  <span>At least 8 characters</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    newPwChecks.hasAlphabet ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{newPwChecks.hasAlphabet ? "✓" : "○"}</span>
                  <span>Contains an alphabet letter (A–Z)</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    newPwChecks.hasNumber ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{newPwChecks.hasNumber ? "✓" : "○"}</span>
                  <span>Contains 1 or more numbers (0–9)</span>
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    newPwChecks.hasSpecial ? "text-emerald-400" : "text-neutral-400"
                  }`}
                >
                  <span>{newPwChecks.hasSpecial ? "✓" : "○"}</span>
                  <span>Contains 1 or more special characters (!@#$%^&amp;*)</span>
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-200">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-neutral-400">
          Need an account?{" "}
          <Link href="/signup" className="font-semibold text-white underline">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}

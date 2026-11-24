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

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.5-1.14 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.54-5.17 3.54-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.72-4.96H1.22v3.11C3.2 21.3 7.27 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.61H1.22A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.22 5.39l4.06-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.27 0 3.2 2.7 1.22 6.61l4.06 3.11c.95-2.85 3.6-4.97 6.72-4.97z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot" | "recovery">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | "azure" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const newPwChecks = getPasswordChecklist(newPassword);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let mounted = true;

    async function initAuthSession() {
      const params = new URLSearchParams(window.location.search);
      const qMode = params.get("mode");
      const qError = params.get("error");
      const code = params.get("code");
      const hash = window.location.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");

      if (qError) {
        setErrorMsg(qError);
      }

      if (qMode === "forgot") {
        setMode("forgot");
      } else if (qMode === "update" || hashType === "recovery") {
        setMode("recovery");
      }

      if (code) {
        const { error } = await supabase!.auth.exchangeCodeForSession(code);
        if (!error && mounted) {
          setMode("recovery");
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase!.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && mounted) {
          setMode("recovery");
        }
      }
    }

    initAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSocialSignIn(provider: "google" | "apple" | "azure") {
    setErrorMsg(null);
    setSuccessMsg(null);
    setOauthLoading(provider);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client is not configured.");

      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback?next=/`,
          ...(provider === "azure" ? { scopes: "email profile openid" } : {}),
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Social sign-in is not enabled yet in Supabase."
      );
      setOauthLoading(null);
    }
  }

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
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/login?mode=update")}`,
        }
      );

      if (error) {
        if (/rate limit/i.test(error.message)) {
          throw new Error(
            "Too many reset emails were sent recently (Supabase default limit is 2 emails/hour). Please wait about an hour or configure Custom SMTP in Supabase Authentication settings."
          );
        }
        throw new Error(error.message);
      }

      setSuccessMsg(
        "Password reset link sent! Open the newest email in your inbox/spam folder and click the link to set your new password."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoveryUpdatePassword(e: FormEvent) {
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
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error(
          "Your reset link expired or was already used. Request a new reset link below."
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
              ? "Reset your password"
              : "Set a new password"}
          </h1>
          <p className="text-sm text-neutral-400">
            {mode === "login"
              ? "Continue with a social account or sign in with your email."
              : mode === "forgot"
              ? "Enter your account email and we will send you a password reset link."
              : "Choose a strong new password for your Postoll account."}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3.5 text-sm text-emerald-200">
            <div>{successMsg}</div>
            <div className="text-xs font-semibold">
              <Link href="/" className="underline text-white">
                Go to Dashboard →
              </Link>
            </div>
          </div>
        )}

        {mode === "login" && (
          <>
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={oauthLoading !== null || loading}
                onClick={() => handleSocialSignIn("google")}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-[#141414] py-2.5 text-sm font-medium text-white hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
              >
                <GoogleIcon />
                <span>
                  {oauthLoading === "google" ? "Connecting to Google..." : "Continue with Google"}
                </span>
              </button>

              <button
                type="button"
                disabled={oauthLoading !== null || loading}
                onClick={() => handleSocialSignIn("apple")}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-[#141414] py-2.5 text-sm font-medium text-white hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
              >
                <AppleIcon />
                <span>
                  {oauthLoading === "apple" ? "Connecting to Apple..." : "Continue with Apple"}
                </span>
              </button>

              <button
                type="button"
                disabled={oauthLoading !== null || loading}
                onClick={() => handleSocialSignIn("azure")}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-[#141414] py-2.5 text-sm font-medium text-white hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
              >
                <MicrosoftIcon />
                <span>
                  {oauthLoading === "azure"
                    ? "Connecting to Microsoft..."
                    : "Continue with Microsoft"}
                </span>
              </button>
            </div>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/15" />
              <span className="mx-3 shrink text-xs uppercase tracking-wider text-neutral-500">
                or with email
              </span>
              <div className="flex-grow border-t border-white/15" />
            </div>

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
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-neutral-300 underline hover:text-white"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 pr-16 text-sm text-white focus:border-white/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                  >
                    {showLoginPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || oauthLoading !== null}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </>
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

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-neutral-300 underline hover:text-white"
              >
                ← Back to Sign in
              </button>
            </div>
          </form>
        )}

        {mode === "recovery" && (
          <form onSubmit={handleRecoveryUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-neutral-200">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 pr-16 text-sm text-white focus:border-white/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
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
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 pr-16 text-sm text-white focus:border-white/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-neutral-300 underline hover:text-white"
              >
                Need a new reset link?
              </button>
            </div>
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

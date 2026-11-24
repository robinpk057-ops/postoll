"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getPasswordChecklist,
  validateEmailAddress,
  validateFullName,
  validateInstagramUsername,
  validateStrongPassword,
} from "@/lib/security";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [alreadySignedUpEmail, setAlreadySignedUpEmail] = useState<string | null>(null);

  const pwChecks = getPasswordChecklist(password);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setAlreadySignedUpEmail(null);

    const nameCheck = validateFullName(fullName);
    if (!nameCheck.valid) {
      setErrorMsg(nameCheck.error || "Invalid full name.");
      return;
    }

    const userCheck = validateInstagramUsername(username);
    if (!userCheck.valid) {
      setErrorMsg(userCheck.error || "Invalid username.");
      return;
    }

    const emailCheck = validateEmailAddress(email);
    if (!emailCheck.valid) {
      setErrorMsg(emailCheck.error || "Invalid email.");
      return;
    }

    const pwCheck = validateStrongPassword(password);
    if (!pwCheck.valid) {
      setErrorMsg(pwCheck.error || "Password does not meet security requirements.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase client is not configured.");
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = userCheck.normalized;

      const { data: availRows, error: availError } = await supabase.rpc(
        "check_signup_availability",
        {
          p_email: cleanEmail,
          p_username: cleanUsername,
        }
      );

      const avail = Array.isArray(availRows) ? availRows[0] : availRows;
      if (!availError && avail) {
        if (avail.email_exists) {
          setAlreadySignedUpEmail(cleanEmail);
          setErrorMsg(
            "An account with this email is already signed up. Please sign in or use Forgot password."
          );
          return;
        }
        if (avail.username_exists) {
          setErrorMsg(
            `The username "@${cleanUsername}" is already taken. Choose another unique username.`
          );
          return;
        }
      }

      const origin = window.location.origin;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/login`,
          data: {
            full_name: fullName.trim(),
            username: cleanUsername,
          },
        },
      });

      if (signUpError) {
        if (/already registered|already exists/i.test(signUpError.message)) {
          setAlreadySignedUpEmail(cleanEmail);
          setErrorMsg(
            "An account with this email is already signed up. Please sign in or reset your password."
          );
          return;
        }
        throw new Error(signUpError.message);
      }

      if (signUpData.user) {
        await supabase.from("profiles").upsert(
          {
            id: signUpData.user.id,
            full_name: fullName.trim(),
            username: cleanUsername,
            email: cleanEmail,
          },
          { onConflict: "id" }
        );
      }

      setInfoMsg(
        "Account created! If a confirmation email does not arrive in your inbox or spam folder (for example due to email rate limits), you can sign in directly or use Forgot password on the Login page."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/15 bg-[#0c0c0c] p-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-neutral-400">Start building with Postoll.</p>
        </div>

        {errorMsg && (
          <div className="space-y-2 rounded-xl border border-red-500/40 bg-red-500/15 p-3.5 text-sm text-red-200">
            <div>{errorMsg}</div>
            {alreadySignedUpEmail && (
              <div className="flex flex-wrap gap-3 pt-1 text-xs font-semibold">
                <Link href="/login" className="underline text-white">
                  Go to Login
                </Link>
                <Link href="/login?mode=forgot" className="underline text-amber-200">
                  Forgot password?
                </Link>
              </div>
            )}
          </div>
        )}

        {infoMsg && (
          <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3.5 text-sm text-emerald-200">
            <div>{infoMsg}</div>
            <div className="pt-1 text-xs font-semibold">
              <Link href="/login" className="underline text-white">
                Continue to Login →
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-200">
              Full name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-neutral-200">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 text-sm text-white focus:border-white/50 focus:outline-none"
            />
            <p className="text-xs text-neutral-400">
              3–30 characters: lowercase letters, numbers, periods (.), or underscores (_).
            </p>
          </div>

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
            <label className="block text-sm font-medium text-neutral-200">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full rounded-xl border border-white/20 bg-[#141414] px-4 py-3 pr-16 text-sm text-white focus:border-white/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <ul className="space-y-1 pt-1.5 text-xs">
              <li
                className={`flex items-center gap-2 ${
                  pwChecks.minLength ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span>{pwChecks.minLength ? "✓" : "○"}</span>
                <span>At least 8 characters</span>
              </li>
              <li
                className={`flex items-center gap-2 ${
                  pwChecks.hasAlphabet ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span>{pwChecks.hasAlphabet ? "✓" : "○"}</span>
                <span>Contains an alphabet letter (A–Z)</span>
              </li>
              <li
                className={`flex items-center gap-2 ${
                  pwChecks.hasNumber ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span>{pwChecks.hasNumber ? "✓" : "○"}</span>
                <span>Contains 1 or more numbers (0–9)</span>
              </li>
              <li
                className={`flex items-center gap-2 ${
                  pwChecks.hasSpecial ? "text-emerald-400" : "text-neutral-400"
                }`}
              >
                <span>{pwChecks.hasSpecial ? "✓" : "○"}</span>
                <span>Contains 1 or more special characters (!@#$%^&amp;*)</span>
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-white underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}

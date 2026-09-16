"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSuccess("Account created successfully. Redirecting...");

      router.push("/");
      router.refresh();

      return;
    }

    setSuccess(
      "Account created. Please check your email to confirm your account."
    );

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          border: "1px solid #333",
          borderRadius: "16px",
          padding: "32px",
          background: "#080808",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
          Create your account
        </h1>

        <p
          style={{
            color: "#999",
            marginBottom: "28px",
          }}
        >
          Start building with Postoll.
        </p>

        <form onSubmit={handleSignup}>
          {/* Full Name */}
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Full name
          </label>

          <input
            type="text"
            placeholder="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: "18px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Email */}
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Email
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              marginBottom: "18px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "#fff",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Password */}
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Password
          </label>

          <div
            style={{
              position: "relative",
              marginBottom: "20px",
            }}
          >
            <input
              type={showPassword ? "text" : "password"}
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "12px 48px 12px 14px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: "#111",
                color: "#fff",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
              title={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "transparent",
                color: "#888",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showPassword ? (
                /* Eye Off */
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 2l20 20" />
                  <path d="M6.7 6.7C4.9 8 3.5 9.8 2.5 12c2 4.2 5.5 7 9.5 7 1.7 0 3.3-.5 4.7-1.3" />
                  <path d="M10.7 10.7a2 2 0 0 0 2.6 2.6" />
                  <path d="M9.9 4.3C10.6 4.1 11.3 4 12 4c4 0 7.5 2.8 9.5 7-.4.9-.9 1.8-1.5 2.6" />
                </svg>
              ) : (
                /* Eye */
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#220909",
                border: "1px solid #552020",
                color: "#ff7777",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px",
                borderRadius: "8px",
                background: "#09220f",
                border: "1px solid #20552d",
                color: "#72e28b",
                fontSize: "14px",
              }}
            >
              {success}
            </div>
          )}

          {/* Create Account */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "8px",
              border: "none",
              background: "#fff",
              color: "#000",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Login Link */}
        <p
          style={{
            marginTop: "24px",
            textAlign: "center",
            color: "#999",
            fontSize: "14px",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#fff",
              textDecoration: "underline",
            }}
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
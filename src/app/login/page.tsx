"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogIn, Mail, ArrowLeft } from "lucide-react";

type Mode = "password" | "magic_link" | "reset";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("password");
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/callback",
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a sign-in link.");
    }
    setLoading(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/reset-password",
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a password reset link.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-sm font-bold tracking-wide text-cs-text-primary">
            CALL STREAM AI
          </h1>
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-0.5">
            ONBOARDING PLATFORM
          </p>
        </div>

        <div className="cs-card p-6">
          {/* Password login */}
          {mode === "password" && (
            <>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
                Sign in
              </h2>
              <p className="text-sm text-cs-text-secondary mb-6">
                Enter your credentials to continue
              </p>

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="cs-label block mb-1.5">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="cs-input"
                    required
                  />
                </div>
                <div>
                  <label className="cs-label block mb-1.5">PASSWORD</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="cs-input"
                    required
                  />
                </div>

                {error && <p className="text-xs text-cs-accent-red">{error}</p>}

                <button type="submit" disabled={loading} className="cs-btn-primary w-full">
                  <LogIn size={16} />
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { setMode("magic_link"); setError(""); setSuccess(""); }}
                  className="w-full text-xs text-cs-accent-blue hover:underline text-center"
                >
                  Sign in with magic link instead
                </button>
                <button
                  onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                  className="w-full text-xs text-cs-text-muted hover:text-cs-text-secondary text-center"
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {/* Magic link */}
          {mode === "magic_link" && (
            <>
              <button
                onClick={() => { setMode("password"); setError(""); setSuccess(""); }}
                className="flex items-center gap-1 text-xs text-cs-text-muted hover:text-cs-text-secondary mb-4"
              >
                <ArrowLeft size={12} /> Back to password
              </button>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
                Magic link
              </h2>
              <p className="text-sm text-cs-text-secondary mb-6">
                We will send a sign-in link to your email
              </p>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="cs-label block mb-1.5">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="cs-input"
                    required
                  />
                </div>

                {error && <p className="text-xs text-cs-accent-red">{error}</p>}
                {success && <p className="text-xs text-cs-accent-green">{success}</p>}

                <button type="submit" disabled={loading} className="cs-btn-primary w-full">
                  <Mail size={16} />
                  {loading ? "Sending..." : "Send magic link"}
                </button>
              </form>
            </>
          )}

          {/* Reset password */}
          {mode === "reset" && (
            <>
              <button
                onClick={() => { setMode("password"); setError(""); setSuccess(""); }}
                className="flex items-center gap-1 text-xs text-cs-text-muted hover:text-cs-text-secondary mb-4"
              >
                <ArrowLeft size={12} /> Back to sign in
              </button>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
                Reset password
              </h2>
              <p className="text-sm text-cs-text-secondary mb-6">
                Enter your email to receive a reset link
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="cs-label block mb-1.5">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="cs-input"
                    required
                  />
                </div>

                {error && <p className="text-xs text-cs-accent-red">{error}</p>}
                {success && <p className="text-xs text-cs-accent-green">{success}</p>}

                <button type="submit" disabled={loading} className="cs-btn-primary w-full">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          )}

          <p className="text-xs text-cs-text-muted text-center mt-4">
            No account?{" "}
            <Link href="/register" className="text-cs-accent-blue hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

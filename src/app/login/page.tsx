"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn, Mail, ArrowLeft, KeyRound } from "lucide-react";

type Mode = "password" | "magic_link" | "reset";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
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
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  // Step 1: send a 6-digit code to the user's email.
  // Codes are typed (never clicked), so email security scanners such as
  // Microsoft Safe Links / Outlook / Teams cannot consume them.
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    if (error) {
      setError(error.message);
    } else {
      setCodeSent(true);
      setSuccess("We emailed you a Magic Code. Enter it below.");
    }
    setLoading(false);
  }

  // Step 2: verify the typed code and establish the session.
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/reset-password",
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email for a password reset link.");
    }
    setLoading(false);
  }

  function resetMagicState() {
    setCodeSent(false);
    setCode("");
    setError("");
    setSuccess("");
  }

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Call Stream AI"
            className="h-10 w-auto object-contain"
          />
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-2">
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
                    placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
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
                  onClick={() => { setMode("magic_link"); resetMagicState(); }}
                  className="w-full text-xs text-cs-accent-blue hover:underline text-center"
                >
                  Sign in with Magic Code instead
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

          {/* Email code (magic link replacement) */}
          {mode === "magic_link" && (
            <>
              <button
                onClick={() => { setMode("password"); resetMagicState(); }}
                className="flex items-center gap-1 text-xs text-cs-text-muted hover:text-cs-text-secondary mb-4"
              >
                <ArrowLeft size={12} /> Back to password
              </button>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
                {codeSent ? "Enter your Magic Code" : "Sign in with Magic Code"}
              </h2>
              <p className="text-sm text-cs-text-secondary mb-6">
                {codeSent
                  ? "We sent the Magic Code we emailed you. Enter it below."
                  : "We will email you a Magic Code"}
              </p>

              {!codeSent ? (
                <form onSubmit={handleSendCode} className="space-y-4">
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
                    {loading ? "Sending..." : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="cs-label block mb-1.5">MAGIC CODE</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Enter code"
                      className="cs-input tracking-[0.5em] text-center text-lg"
                      required
                    />
                  </div>

                  {error && <p className="text-xs text-cs-accent-red">{error}</p>}
                  {success && <p className="text-xs text-cs-accent-green">{success}</p>}

                  <button type="submit" disabled={loading || code.length < 6} className="cs-btn-primary w-full">
                    <KeyRound size={16} />
                    {loading ? "Verifying..." : "Verify & sign in"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading}
                    className="w-full text-xs text-cs-accent-blue hover:underline text-center"
                  >
                    Resend code
                  </button>
                </form>
              )}
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

        </div>
      </div>
    </div>
  );
}

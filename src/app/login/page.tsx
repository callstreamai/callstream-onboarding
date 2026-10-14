"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, KeyRound } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Step 1: send a 6-8 digit code to an existing, admin-created user.
  // shouldCreateUser=false is critical: unknown emails cannot self-register.
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
      setError("If this email has access, a Magic Code can be sent. Please contact your administrator if you need access.");
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
      setError("That code is invalid or expired. Please request a new code or contact your administrator.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  function resetCodeState() {
    setCodeSent(false);
    setCode("");
    setError("");
    setSuccess("");
  }

  return (
    <div className="min-h-screen bg-cs-bg bg-[radial-gradient(ellipse_at_top,rgba(232,121,198,0.12),transparent_60%)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Call Stream AI"
            className="h-10 w-auto object-contain"
          />
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-2">
            YOUR CALL STREAM LAUNCH WORKSPACE
          </p>
        </div>

        <div className="cs-card p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
            {codeSent ? "Enter your Magic Code" : "Welcome to your next chapter."}
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            {codeSent
              ? "Enter the sign-in code we sent to your email."
              : "Bring your property, knowledge, and voice together. Sign in with your invited email to get started."}
          </p>

          {!codeSent ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="cs-label block mb-1.5">EMAIL</label>
                <input
                  id="login-email"
                  autoComplete="email"
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

              <p className="text-[11px] text-cs-text-muted leading-relaxed text-center">
                Access is invite-only. If you do not have an admin-created account,
                you will not be able to sign in or create one here.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="login-code" className="cs-label block mb-1.5">MAGIC CODE</label>
                <input
                  id="login-code"
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

              <button
                type="button"
                onClick={resetCodeState}
                disabled={loading}
                className="w-full text-xs text-cs-text-muted hover:text-cs-text-secondary text-center"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

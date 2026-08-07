"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, KeyRound } from "lucide-react";

type Stage = "checking" | "enter_code" | "set_password";

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // If a link-based flow lands here with a code/token_hash, use the secure route.
      const search = window.location.search;
      const sp = new URLSearchParams(search);
      if (sp.get("code") || sp.get("token_hash")) {
        window.location.replace("/auth/callback" + search);
        return;
      }
      // Legacy implicit hash flow -> /auth/handle.
      const hash = window.location.hash;
      if (hash && hash.includes("access_token=") && hash.includes("type=recovery")) {
        router.replace("/auth/handle" + hash);
        return;
      }

      // If a recovery session is already established (arrived via link), go straight to set-password.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) setStage("set_password");
        return;
      }

      // Otherwise show the CODE ENTRY step: the recovery email delivers an 8-digit code.
      if (!cancelled) setStage("enter_code");
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Step A: verify the typed recovery code -> establishes a recovery session.
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanCode = resetCode.trim();

    // Recovery-issued OTP: verify as type "recovery".
    let { error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: "recovery",
    });
    // Fallback for tokens issued as generic email OTP.
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "email",
      });
      error = retry.error;
    }

    if (error) {
      setError("That code is invalid or expired. Request a new reset code and try again.");
      setLoading(false);
      return;
    }
    setStage("set_password");
    setLoading(false);
  }

  // Step B: set the new password on the established session.
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const pw = password.trim();
    const cpw = confirmPassword.trim();
    if (pw !== cpw) { setError("Passwords do not match"); return; }
    if (pw.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess("Password updated. Redirecting...");
      setTimeout(() => router.push("/"), 1500);
    }
  }

  if (stage === "checking") {
    return (
      <div className="min-h-screen bg-cs-bg flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-cs-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Call Stream AI" className="h-10 w-auto object-contain" />
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-2">
            ONBOARDING PLATFORM
          </p>
        </div>

        <div className="cs-card p-6">
          {stage === "enter_code" && (
            <>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">Enter your reset code</h2>
              <p className="text-sm text-cs-text-secondary mb-6">
                We emailed you a password reset code. Enter your email and the code below.
              </p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="cs-label block mb-1.5">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="cs-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="cs-label block mb-1.5">RESET CODE</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Enter code"
                    className="cs-input w-full tracking-[0.4em] text-center text-lg"
                    required
                  />
                </div>

                {error && <p className="text-xs text-cs-accent-red">{error}</p>}

                <button type="submit" disabled={loading || resetCode.length < 6} className="cs-btn-primary w-full">
                  <KeyRound size={16} />
                  {loading ? "Verifying..." : "Verify code"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full text-xs text-cs-text-muted hover:text-cs-text-secondary text-center"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {stage === "set_password" && (
            <>
              <h2 className="text-lg font-semibold text-cs-text-primary mb-1">Set new password</h2>
              <p className="text-sm text-cs-text-secondary mb-6">Enter your new password below</p>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="cs-label block mb-1.5">NEW PASSWORD</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="cs-input w-full"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="cs-label block mb-1.5">CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="cs-input w-full"
                    minLength={6}
                    required
                  />
                </div>

                {error && <p className="text-xs text-cs-accent-red">{error}</p>}
                {success && <p className="text-xs text-cs-accent-green">{success}</p>}

                <button type="submit" disabled={loading} className="cs-btn-primary w-full">
                  <Lock size={16} />
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

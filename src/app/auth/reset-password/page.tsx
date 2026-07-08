"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Handle both hash-based tokens (implicit flow) and code-based (PKCE)
    // Supabase JS v2 automatically exchanges the hash tokens on client init.
    // We listen for the auth state to confirm a session is established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (session) {
          setSessionReady(true);
        }
      }
    });

    // Also check for an existing session (e.g. after callback redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sessionReady) {
      setError("Auth session missing! Please use the link from your email and try again.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated. Redirecting...");
      setTimeout(() => router.push("/"), 2000);
    }
    setLoading(false);
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
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
            Set new password
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            Enter your new password below
          </p>

          {!sessionReady && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md bg-cs-accent-orange/10">
              <p className="text-xs text-cs-accent-orange">
                Waiting for your session… make sure you opened this page directly from the link in your email.
              </p>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
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

            <button type="submit" disabled={loading || !sessionReady} className="cs-btn-primary w-full">
              <Lock size={16} />
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

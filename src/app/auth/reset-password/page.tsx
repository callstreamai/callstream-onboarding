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
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // PKCE / token_hash: let the secure server route establish the session.
      const search = window.location.search;
      const sp = new URLSearchParams(search);
      if (sp.get("code") || sp.get("token_hash")) {
        window.location.replace("/auth/callback" + search);
        return;
      }

      // Legacy implicit flow: hash tokens -> route through /auth/handle.
      const hash = window.location.hash;
      if (hash && hash.includes("access_token=") && hash.includes("type=recovery")) {
        router.replace("/auth/handle" + hash);
        return;
      }

      // Check for an existing session (arrived here after /auth/callback or /auth/handle).
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!cancelled) { setSessionReady(true); setChecking(false); }
        return;
      }

      // Listen briefly for the recovery session to attach.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session && !cancelled) {
          setSessionReady(true);
          setChecking(false);
        }
      });

      // If no session has attached shortly after load, this is a dead link
      // (expired, already used, or opened without a valid recovery token).
      // Instead of showing a form with a permanently disabled button, send the
      // user back to login with a clear message.
      setTimeout(() => {
        if (!cancelled && !sessionReady) {
          subscription.unsubscribe();
          router.replace("/login?error=" + encodeURIComponent("reset_link_invalid"));
        }
      }, 2500);

      return () => subscription.unsubscribe();
    }

    init();
    return () => { cancelled = true; };
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sessionReady) {
      setError("No active session. Please use the link from your email.");
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

  if (checking) {
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
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">Set new password</h2>
          <p className="text-sm text-cs-text-secondary mb-6">Enter your new password below</p>

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

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
  const router = useRouter();
  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

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
        <div className="mb-8 text-center">
          <h1 className="text-sm font-bold tracking-wide text-cs-text-primary">
            <img src="https://47891501.fs1.hubspotusercontent-na1.net/hubfs/47891501/Logos/White%20Call%20Stream%20Logo.png" alt="Call Stream AI" className="h-8 w-auto" />
          </h1>
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-0.5">
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

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="cs-label block mb-1.5">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="cs-input"
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
                className="cs-input"
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
        </div>
      </div>
    </div>
  );
}

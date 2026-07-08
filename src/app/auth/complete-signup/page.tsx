"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, User, CheckCircle2 } from "lucide-react";

export default function CompleteSignupPage() {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Confirm we have an active session from the invite link
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUserEmail(data.user.email || "");
        // Pre-fill name if available
        if (data.user.user_metadata?.full_name) {
          setFullName(data.user.user_metadata.full_name);
        }
      }
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Set password and update name
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName.trim() },
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Update profile table with full name
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName.trim() })
          .eq("id", userData.user.id);
      }

      // Redirect to dashboard
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
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
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">Complete your account</h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            Welcome! Set your name and create a password to get started.
          </p>

          {userEmail && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-cs-accent-blue/10 mb-5">
              <CheckCircle2 size={13} className="text-cs-accent-blue flex-shrink-0" />
              <p className="text-xs text-cs-accent-blue truncate">{userEmail}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="cs-label block mb-1.5">YOUR NAME</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="cs-input pl-9 w-full"
                  required
                />
              </div>
            </div>

            <div>
              <label className="cs-label block mb-1.5">CREATE PASSWORD</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="cs-input pl-9 w-full"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <label className="cs-label block mb-1.5">CONFIRM PASSWORD</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="cs-input pl-9 w-full"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-cs-accent-red">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cs-btn-primary w-full mt-2"
            >
              {loading ? "Setting up your account..." : "Complete Registration"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

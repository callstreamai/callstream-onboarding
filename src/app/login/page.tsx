"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
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
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
            Sign in
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            Enter your credentials to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
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

            {error && (
              <p className="text-xs text-cs-accent-red">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cs-btn-primary w-full"
            >
              <LogIn size={16} />
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-cs-text-muted text-center mt-4">
            No account?{" "}
            <Link
              href="/register"
              className="text-cs-accent-blue hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

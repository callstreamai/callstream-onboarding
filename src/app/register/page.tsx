"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Step 1: Sign up via Supabase auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
        emailRedirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/callback",
      },
    });

    if (signUpError) {
      // If trigger fails, try to create profile via API fallback
      if (signUpError.message.includes("Database error")) {
        try {
          const res = await fetch("/api/register-fallback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, fullName, companyName }),
          });
          const result = await res.json();
          if (result.success) {
            setSuccess("Account created. Check your email to confirm, then sign in.");
            setLoading(false);
            return;
          } else {
            setError(result.error || "Registration failed. Please contact support.");
            setLoading(false);
            return;
          }
        } catch {
          setError("Registration failed. Please contact support.");
          setLoading(false);
          return;
        }
      }
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      setSuccess("Account created! Check your email to confirm your account.");
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
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
            Create account
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            Register to start onboarding your property
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="cs-label block mb-1.5">FULL NAME</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="cs-input"
                required
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">COMPANY NAME</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company"
                className="cs-input"
                required
              />
            </div>
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
                placeholder="Min 6 characters"
                className="cs-input"
                minLength={6}
                required
              />
            </div>

            {error && <p className="text-xs text-cs-accent-red">{error}</p>}
            {success && <p className="text-xs text-cs-accent-green">{success}</p>}

            <button type="submit" disabled={loading} className="cs-btn-primary w-full">
              <UserPlus size={16} />
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="text-xs text-cs-text-muted text-center mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-cs-accent-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

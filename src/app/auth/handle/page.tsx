"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthHandlePage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    async function handleHash() {
      // Parse hash fragment — Supabase implicit flow sends tokens here
      const hash = window.location.hash.substring(1);
      if (!hash) {
        setStatus("No auth token found. Redirecting...");
        setTimeout(() => router.push("/login?error=no_token"), 1500);
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken  = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type         = params.get("type") ?? "";
      const error        = params.get("error");
      const errorDesc    = params.get("error_description");

      if (error) {
        setStatus("Auth error: " + (errorDesc || error));
        setTimeout(() => router.push("/login?error=" + encodeURIComponent(error)), 2000);
        return;
      }

      if (!accessToken || !refreshToken) {
        setStatus("Invalid token. Redirecting to login...");
        setTimeout(() => router.push("/login?error=invalid_token"), 1500);
        return;
      }

      // Set the session from the hash tokens
      const { data, error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionErr || !data?.user) {
        setStatus("Session error. Redirecting to login...");
        setTimeout(() => router.push("/login?error=session_failed"), 1500);
        return;
      }

      const user = data.user;

      // Route based on type and whether user has signed in before
      if (type === "recovery") {
        router.push("/auth/reset-password");
        return;
      }

      // New user (never signed in, or explicitly an invite)
      const isNew = !user.last_sign_in_at;
      if (type === "invite" || (type === "magiclink" && isNew)) {
        setStatus("Account ready! Setting up your portal...");
        router.push("/auth/complete-signup");
        return;
      }

      // Returning user — go to dashboard
      setStatus("Welcome back! Redirecting...");
      router.push("/submissions");
    }

    handleHash();
  }, []);

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-6 h-6 rounded-full border-2 border-cs-accent-blue border-t-transparent animate-spin" />
        <p className="text-sm text-cs-text-muted">{status}</p>
      </div>
    </div>
  );
}

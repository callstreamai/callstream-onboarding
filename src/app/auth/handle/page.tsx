"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthHandlePage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    async function handleAuth() {
      // --- PKCE / token_hash safety net ---------------------------------
      // If Supabase sent a query-string code (PKCE) or token_hash instead of a
      // hash fragment, the secure server route /auth/callback must handle it
      // (it holds the code exchange + cookie set). Forward there immediately.
      const search = window.location.search;
      const sp = new URLSearchParams(search);
      if (sp.get("code") || sp.get("token_hash")) {
        window.location.replace("/auth/callback" + search);
        return;
      }

      // Parse hash fragment — legacy Supabase implicit flow sends tokens here
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
      const errorCode    = params.get("error_code");
      const errorDesc    = params.get("error_description");

      if (error) {
        // A pre-consumed / expired single-use link (commonly caused by email
        // security scanners opening the link first) lands here. Give the user a
        // clear, actionable message instead of silently bouncing to /login.
        if (errorCode === "otp_expired" || error === "access_denied") {
          setStatus("This sign-in link has already been used or expired. Redirecting you to sign in with your password...");
          setTimeout(
            () => router.push("/login?error=" + encodeURIComponent("link_expired")),
            2500
          );
          return;
        }
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

    handleAuth();
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

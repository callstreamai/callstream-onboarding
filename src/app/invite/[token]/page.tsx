"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "error">("loading");
  const [invitation, setInvitation] = useState<any>(null);

  useEffect(() => {
    async function checkInvite() {
      const res = await fetch("/api/invite/" + token);
      if (res.ok) {
        const data = await res.json();
        setInvitation(data.invitation);
        setStatus("valid");
      } else {
        setStatus("expired");
      }
    }
    checkInvite();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-cs-bg flex items-center justify-center">
        <p className="text-cs-text-muted">Checking invitation...</p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
        <div className="cs-card p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold text-cs-text-primary mb-2">Invitation expired</h2>
          <p className="text-sm text-cs-text-muted">This invitation link is no longer valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-sm font-bold tracking-wide text-cs-text-primary"><img src="https://47891501.fs1.hubspotusercontent-na1.net/hubfs/47891501/Logos/White%20Call%20Stream%20Logo.png" alt="Call Stream AI" className="h-8 w-auto" /></h1>
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-0.5">ONBOARDING PLATFORM</p>
        </div>

        <div className="cs-card p-6 text-center">
          <h2 className="text-lg font-semibold text-cs-text-primary mb-2">
            You have been invited
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            to collaborate on a property onboarding project
          </p>

          <div className="space-y-3">
            <Link
              href={"/register?invite=" + token}
              className="cs-btn-primary w-full block text-center"
            >
              Create account
            </Link>
            <Link
              href={"/login?invite=" + token}
              className="block text-xs text-cs-accent-blue hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

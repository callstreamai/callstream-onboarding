"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CompleteSignupPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "/" : "/login");
    });
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-6 h-6 rounded-full border-2 border-cs-accent-blue border-t-transparent animate-spin" />
        <p className="text-sm text-cs-text-muted">Redirecting...</p>
      </div>
    </div>
  );
}

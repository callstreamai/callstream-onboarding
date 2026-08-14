"use client";

import { useRouter } from "next/navigation";

export default function EventScraperDisabledPage() {
  const router = useRouter();

  return (
    <div className="max-w-xl">
      <div className="cs-card p-6">
        <h1 className="text-lg font-semibold text-cs-text-primary mb-2">Event portal removed</h1>
        <p className="text-sm text-cs-text-muted mb-5">
          The event portal is no longer available in this onboarding platform.
        </p>
        <button onClick={() => router.push("/")} className="cs-btn-primary text-sm">
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

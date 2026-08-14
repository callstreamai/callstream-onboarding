"use client";

import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cs-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Call Stream AI"
            className="h-10 w-auto object-contain"
          />
          <p className="text-[10px] text-cs-text-muted uppercase tracking-widest mt-2">
            ONBOARDING PLATFORM
          </p>
        </div>

        <div className="cs-card p-6">
          <h2 className="text-lg font-semibold text-cs-text-primary mb-1">
            Registration is invite-only
          </h2>
          <p className="text-sm text-cs-text-secondary mb-6">
            Users must be created by an administrator before they can sign in. If you already have access, use your enrolled email to request a Magic Code.
          </p>
          <button onClick={() => router.push("/login")} className="cs-btn-primary w-full">
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}

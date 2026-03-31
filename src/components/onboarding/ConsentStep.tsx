"use client";

import { useOnboardingStore } from "@/lib/store";
import { Check, Shield, ArrowRight } from "lucide-react";

export function ConsentStep() {
  const {
    consentGiven,
    termsAccepted,
    setConsentGiven,
    setTermsAccepted,
    setStep,
  } = useOnboardingStore();

  const canProceed = consentGiven && termsAccepted;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cs-card border border-cs-border rounded-lg">
          <Shield size={20} className="text-cs-accent-blue" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-cs-text-primary">
            Before We Begin
          </h2>
          <p className="text-sm text-cs-text-secondary">
            We need your approval to proceed with onboarding
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Scrape consent */}
        <label className="cs-card-hover flex items-start gap-3 p-4 cursor-pointer">
          <button
            onClick={() => setConsentGiven(!consentGiven)}
            className={`
              mt-0.5 flex-shrink-0 w-5 h-5 rounded border transition-colors
              flex items-center justify-center
              ${consentGiven
                ? "bg-cs-accent-green border-cs-accent-green"
                : "border-cs-border hover:border-cs-border-hover"
              }
            `}
          >
            {consentGiven && <Check size={12} className="text-black" />}
          </button>
          <div>
            <p className="text-sm text-cs-text-primary font-medium">
              Approve web scraping
            </p>
            <p className="text-xs text-cs-text-secondary mt-1">
              I authorize Call Stream AI to crawl and extract content from my
              property website for the purpose of building my AI agent
              knowledge base. Only publicly available pages will be accessed.
            </p>
          </div>
        </label>

        {/* Terms */}
        <label className="cs-card-hover flex items-start gap-3 p-4 cursor-pointer">
          <button
            onClick={() => setTermsAccepted(!termsAccepted)}
            className={`
              mt-0.5 flex-shrink-0 w-5 h-5 rounded border transition-colors
              flex items-center justify-center
              ${termsAccepted
                ? "bg-cs-accent-green border-cs-accent-green"
                : "border-cs-border hover:border-cs-border-hover"
              }
            `}
          >
            {termsAccepted && <Check size={12} className="text-black" />}
          </button>
          <div>
            <p className="text-sm text-cs-text-primary font-medium">
              Accept terms of service
            </p>
            <p className="text-xs text-cs-text-secondary mt-1">
              I agree to the{" "}
              <a
                href="https://terms.callstreamai.com"
                target="_blank"
                className="text-cs-accent-blue hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://privacy.callstreamai.com"
                target="_blank"
                className="text-cs-accent-blue hover:underline"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </label>
      </div>

      <button
        onClick={() => setStep("url_input")}
        disabled={!canProceed}
        className="cs-btn-primary mt-6"
      >
        Continue
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

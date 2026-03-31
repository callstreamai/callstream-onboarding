"use client";

import type { OnboardingStep } from "@/types";
import { Check } from "lucide-react";

const STEPS: { key: OnboardingStep; label: string; number: number }[] = [
  { key: "consent", label: "Consent", number: 1 },
  { key: "url_input", label: "Property URL", number: 2 },
  { key: "file_upload", label: "Upload Files", number: 3 },
  { key: "processing", label: "Processing", number: 4 },
  { key: "status", label: "Complete", number: 5 },
];

interface Props {
  currentStep: OnboardingStep;
}

export function StepIndicator({ currentStep }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={`
                flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
                ${isComplete ? "bg-cs-accent-green/20 text-cs-accent-green" : ""}
                ${isCurrent ? "bg-white text-black" : ""}
                ${!isComplete && !isCurrent ? "bg-cs-card border border-cs-border text-cs-text-muted" : ""}
              `}
            >
              {isComplete ? <Check size={14} /> : step.number}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                isCurrent
                  ? "text-cs-text-primary font-medium"
                  : isComplete
                  ? "text-cs-text-secondary"
                  : "text-cs-text-muted"
              }`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-px ${
                  isComplete ? "bg-cs-accent-green/40" : "bg-cs-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

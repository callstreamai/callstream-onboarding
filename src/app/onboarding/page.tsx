"use client";

import { useOnboardingStore } from "@/lib/store";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ConsentStep } from "@/components/onboarding/ConsentStep";
import { UrlInputStep } from "@/components/onboarding/UrlInputStep";
import { FileUploadStep } from "@/components/onboarding/FileUploadStep";
import { ProcessingStep } from "@/components/onboarding/ProcessingStep";

export default function OnboardingPage() {
  const currentStep = useOnboardingStore((s) => s.currentStep);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Property Onboarding</h1>
      </div>

      <div className="mb-8">
        <StepIndicator currentStep={currentStep} />
      </div>

      <div className="max-w-2xl">
        {currentStep === "consent" && <ConsentStep />}
        {currentStep === "url_input" && <UrlInputStep />}
        {currentStep === "file_upload" && <FileUploadStep />}
        {currentStep === "processing" && <ProcessingStep />}
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useOnboardingStore } from "@/lib/store";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ConsentStep } from "@/components/onboarding/ConsentStep";
import { UrlInputStep } from "@/components/onboarding/UrlInputStep";
import { FileUploadStep } from "@/components/onboarding/FileUploadStep";
import { ProcessingStep } from "@/components/onboarding/ProcessingStep";

export default function AccountOnboardPage() {
  const params = useParams();
  const accountId = params.accountId as string;
  const { currentStep, setStep } = useOnboardingStore();

  useEffect(() => {
    // Pre-load account data into the store
    fetch(`/api/admin/accounts/${accountId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.account) {
          const store = useOnboardingStore.getState();
          if (data.account.property_url) store.setPropertyUrl(data.account.property_url);
          if (data.account.vertical) store.setVertical(data.account.vertical);
          // Store accountId in a way the processing step can use it
          (window as any).__accountId = accountId;
        }
      });
  }, [accountId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Onboard Account</h1>
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

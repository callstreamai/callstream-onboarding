import { create } from "zustand";
import type { OnboardingStep, Vertical, Channel } from "@/types";

interface OnboardingState {
  // Step management
  currentStep: OnboardingStep;
  setStep: (step: OnboardingStep) => void;

  // Consent
  consentGiven: boolean;
  termsAccepted: boolean;
  setConsentGiven: (v: boolean) => void;
  setTermsAccepted: (v: boolean) => void;

  // Property URL
  propertyUrl: string;
  setPropertyUrl: (url: string) => void;

  // Vertical
  vertical: Vertical | null;
  setVertical: (v: Vertical | null) => void;

  // Channels
  channels: Channel[];
  toggleChannel: (ch: Channel) => void;

  // Files
  files: File[];
  addFiles: (f: File[]) => void;
  removeFile: (index: number) => void;

  // Job
  jobId: string | null;
  setJobId: (id: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  currentStep: "consent" as OnboardingStep,
  consentGiven: false,
  termsAccepted: false,
  propertyUrl: "",
  vertical: null as Vertical | null,
  channels: ["voice", "sms", "webchat", "whatsapp"] as Channel[],
  files: [] as File[],
  jobId: null as string | null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setConsentGiven: (v) => set({ consentGiven: v }),
  setTermsAccepted: (v) => set({ termsAccepted: v }),
  setPropertyUrl: (url) => set({ propertyUrl: url }),
  setVertical: (v) => set({ vertical: v }),
  toggleChannel: (ch) =>
    set((state) => ({
      channels: state.channels.includes(ch)
        ? state.channels.filter((c) => c !== ch)
        : [...state.channels, ch],
    })),
  addFiles: (f) => set((state) => ({ files: [...state.files, ...f] })),
  removeFile: (index) =>
    set((state) => ({
      files: state.files.filter((_, i) => i !== index),
    })),
  setJobId: (id) => set({ jobId: id }),
  reset: () => set(initialState),
}));

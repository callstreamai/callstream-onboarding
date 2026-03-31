"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/store";
import { Spinner } from "@/components/ui/Spinner";
import { Check, X, Globe, FileText, Brain } from "lucide-react";

type Phase = "uploading" | "crawling" | "extracting" | "complete" | "error";

interface PhaseStatus {
  phase: Phase;
  label: string;
  icon: React.ReactNode;
  detail: string;
}

export function ProcessingStep() {
  const { propertyUrl, files, vertical, channels, jobId, setJobId, setStep } =
    useOnboardingStore();
  const [currentPhase, setCurrentPhase] = useState<Phase>("uploading");
  const [phases, setPhases] = useState<PhaseStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    startProcessing();
  }, []);

  async function startProcessing() {
    try {
      // Phase 1: Create job + upload files
      setCurrentPhase("uploading");
      setPhases([
        {
          phase: "uploading",
          label: "Creating job & uploading files",
          icon: <Spinner size={16} />,
          detail: `Uploading ${files.length} file(s)...`,
        },
      ]);

      const formData = new FormData();
      formData.append("propertyUrl", propertyUrl);
      if (vertical) formData.append("vertical", vertical);
      formData.append("channels", JSON.stringify(channels));
      for (const file of files) {
        formData.append("files", file);
      }

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();
      const newJobId = uploadData.jobId;
      setJobId(newJobId);

      setPhases((prev) => [
        { ...prev[0], icon: <Check size={16} className="text-cs-accent-green" />, detail: "Done" },
      ]);

      // Phase 2: Crawl
      setCurrentPhase("crawling");
      setPhases((prev) => [
        ...prev,
        {
          phase: "crawling",
          label: "Crawling property website",
          icon: <Spinner size={16} />,
          detail: `Fetching ${propertyUrl}...`,
        },
      ]);

      const crawlRes = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: newJobId, propertyUrl }),
      });

      if (!crawlRes.ok) throw new Error("Crawl failed");
      const crawlData = await crawlRes.json();

      setPhases((prev) => {
        const updated = [...prev];
        updated[1] = {
          ...updated[1],
          icon: <Check size={16} className="text-cs-accent-green" />,
          detail: `${crawlData.pagesCrawled} pages crawled`,
        };
        return updated;
      });

      // Phase 3: Extract
      setCurrentPhase("extracting");
      setPhases((prev) => [
        ...prev,
        {
          phase: "extracting",
          label: "Extracting property data with AI",
          icon: <Spinner size={16} />,
          detail: "Running LLM extraction...",
        },
      ]);

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: newJobId }),
      });

      if (!extractRes.ok) throw new Error("Extraction failed");
      const extractData = await extractRes.json();

      setPhases((prev) => {
        const updated = [...prev];
        updated[2] = {
          ...updated[2],
          icon: <Check size={16} className="text-cs-accent-green" />,
          detail: `Confidence: ${Math.round((extractData.confidence || 0) * 100)}%`,
        };
        return updated;
      });

      setCurrentPhase("complete");
      setPhases((prev) => [
        ...prev,
        {
          phase: "complete",
          label: "Processing complete",
          icon: <Check size={16} className="text-cs-accent-green" />,
          detail: "Ready for review",
        },
      ]);

      // Auto-navigate to status after a short delay
      setTimeout(() => {
        router.push(`/onboarding/${newJobId}/review`);
      }, 2000);
    } catch (err) {
      setCurrentPhase("error");
      setError(err instanceof Error ? err.message : "An error occurred");
      setPhases((prev) => [
        ...prev,
        {
          phase: "error",
          label: "Error",
          icon: <X size={16} className="text-cs-accent-red" />,
          detail: err instanceof Error ? err.message : "An error occurred",
        },
      ]);
    }
  }

  const phaseIcons: Record<string, React.ReactNode> = {
    uploading: <FileText size={16} />,
    crawling: <Globe size={16} />,
    extracting: <Brain size={16} />,
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-cs-text-primary">
          Processing Your Property
        </h2>
        <p className="text-sm text-cs-text-secondary mt-1">
          Crawling website, processing files, and extracting data...
        </p>
      </div>

      <div className="space-y-3">
        {phases.map((p, i) => (
          <div key={i} className="cs-card flex items-center gap-3 p-4">
            <div className="flex-shrink-0">{p.icon}</div>
            <div className="flex-1">
              <p className="text-sm text-cs-text-primary font-medium">
                {p.label}
              </p>
              <p className="text-xs text-cs-text-secondary mt-0.5">
                {p.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 cs-card border-cs-accent-red/30 p-4">
          <p className="text-sm text-cs-accent-red">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setPhases([]);
              startProcessing();
            }}
            className="cs-btn-secondary mt-3 text-xs"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

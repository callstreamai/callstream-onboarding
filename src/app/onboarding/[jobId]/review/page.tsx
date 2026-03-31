"use client";

import { useParams } from "next/navigation";
import { ExtractionPanel } from "@/components/review/ExtractionPanel";

export default function ReviewPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Review Extracted Data</h1>
      <ExtractionPanel jobId={jobId} />
    </div>
  );
}

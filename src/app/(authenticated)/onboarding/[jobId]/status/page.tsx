"use client";

import { useParams } from "next/navigation";
import { StatusScreen } from "@/components/onboarding/StatusScreen";

export default function StatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Onboarding Status</h1>
      <StatusScreen jobId={jobId} />
    </div>
  );
}

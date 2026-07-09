"use client";

import { useParams } from "next/navigation";
import { StatusScreen } from "@/components/onboarding/StatusScreen";
import JobTabs from "@/components/project/JobTabs";

export default function StatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  return (
    <div>
      <JobTabs jobId={jobId} />
      <StatusScreen jobId={jobId} />
    </div>
  );
}

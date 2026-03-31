"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingJob } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { ClipboardCheck, ArrowRight } from "lucide-react";

export default function ReviewQueuePage() {
  const [jobs, setJobs] = useState<OnboardingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs?status=review_pending,review_in_progress,extraction_complete")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    review_pending: "text-cs-accent-orange",
    review_in_progress: "text-cs-accent-blue",
    extraction_complete: "text-cs-accent-purple",
    approved: "text-cs-accent-green",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Review Queue</h1>
        <div className="cs-badge bg-cs-card text-cs-text-secondary">
          {jobs.length} pending
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="cs-card p-12 text-center">
          <ClipboardCheck
            size={40}
            className="mx-auto text-cs-text-muted mb-3"
          />
          <p className="text-cs-text-secondary">No properties pending review</p>
          <Link href="/onboarding" className="cs-btn-primary text-sm mt-4 inline-flex">
            Start New Onboarding
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/onboarding/${job.id}/review`}
              className="cs-card-hover flex items-center justify-between p-4 group"
            >
              <div>
                <p className="text-sm text-cs-text-primary font-medium">
                  {job.property_url}
                </p>
                <p className="text-xs text-cs-text-muted mt-0.5">
                  {job.pages_crawled} pages · {job.files_processed} files ·{" "}
                  {Math.round((job.extraction_confidence || 0) * 100)}% confidence
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`cs-label ${statusColors[job.status] || "text-cs-text-muted"}`}
                >
                  {job.status.replace(/_/g, " ")}
                </span>
                <ArrowRight
                  size={16}
                  className="text-cs-text-muted group-hover:text-cs-text-primary transition-colors"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingJob } from "@/types";
import { StatCard } from "@/components/ui/StatCard";
import { Spinner } from "@/components/ui/Spinner";
import { ClipboardCheck, ExternalLink } from "lucide-react";

interface Props {
  jobId: string;
}

export function StatusScreen({ jobId }: Props) {
  const [job, setJob] = useState<OnboardingJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob();
    const interval = setInterval(fetchJob, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  async function fetchJob() {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="cs-card p-8 text-center">
        <p className="text-cs-text-secondary">Job not found</p>
      </div>
    );
  }

  const statusColor =
    job.status === "approved"
      ? "green"
      : job.status === "error" || job.status === "rejected"
      ? "red"
      : job.status.includes("review")
      ? "purple"
      : "blue";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-cs-text-primary">
            Onboarding Status
          </h2>
          <p className="text-sm text-cs-text-secondary mt-0.5">
            {job.property_url}
          </p>
        </div>
        <div
          className={`cs-badge bg-cs-accent-${statusColor}/10 text-cs-accent-${statusColor}`}
        >
          {job.status.replace(/_/g, " ")}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="PAGES CRAWLED" value={job.pages_crawled} color="blue" />
        <StatCard label="FILES PROCESSED" value={job.files_processed} color="purple" />
        <StatCard
          label="CONFIDENCE"
          value={`${Math.round((job.extraction_confidence || 0) * 100)}%`}
          color="green"
        />
        <StatCard
          label="FIELDS REVIEWED"
          value={`${job.fields_reviewed}/${job.fields_total}`}
          color="orange"
        />
      </div>

      <div className="cs-card p-5">
        <p className="cs-label mb-3">ACTIONS</p>
        <div className="flex gap-3">
          <Link
            href={`/onboarding/${jobId}/review`}
            className="cs-btn-primary text-sm"
          >
            <ClipboardCheck size={16} />
            Review & Approve
          </Link>
          <a
            href={job.property_url}
            target="_blank"
            className="cs-btn-secondary text-sm"
          >
            <ExternalLink size={16} />
            View Property
          </a>
        </div>
      </div>
    </div>
  );
}

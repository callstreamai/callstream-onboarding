"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingJob } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { FolderOpen, ArrowRight, Download, FileInput } from "lucide-react";

export default function MySubmissionsPage() {
  const [jobs, setJobs] = useState<OnboardingJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .finally(() => setLoading(false));
  }, []);

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; text: string }> = {
      approved: { bg: "bg-cs-accent-green/10", text: "text-cs-accent-green" },
      rejected: { bg: "bg-cs-accent-red/10", text: "text-cs-accent-red" },
      error: { bg: "bg-cs-accent-red/10", text: "text-cs-accent-red" },
      extraction_complete: { bg: "bg-cs-accent-purple/10", text: "text-cs-accent-purple" },
      review_pending: { bg: "bg-cs-accent-orange/10", text: "text-cs-accent-orange" },
      review_in_progress: { bg: "bg-cs-accent-blue/10", text: "text-cs-accent-blue" },
    };
    const s = map[status] || { bg: "bg-cs-card", text: "text-cs-text-muted" };
    return `cs-badge ${s.bg} ${s.text}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Submissions</h1>
        <Link href="/onboarding" className="cs-btn-primary text-sm">
          <FileInput size={16} />
          New Onboarding
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : jobs.length === 0 ? (
        <div className="cs-card p-12 text-center">
          <FolderOpen size={40} className="mx-auto text-cs-text-muted mb-3" />
          <p className="text-cs-text-secondary">No submissions yet</p>
          <Link href="/onboarding" className="cs-btn-primary text-sm mt-4 inline-flex">
            Start Onboarding
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="cs-card-hover flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-cs-text-primary font-medium">{job.property_url}</p>
                  <span className={statusBadge(job.status)}>
                    {job.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-cs-text-muted mt-1">
                  {job.pages_crawled} pages · {job.files_processed} files
                  {job.extraction_confidence ? ` · ${Math.round(job.extraction_confidence * 100)}% confidence` : ""}
                  {" · "}
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {job.status === "approved" && (
                  <a
                    href={`/api/jobs/${job.id}/export`}
                    className="cs-btn-secondary text-xs py-1.5"
                    download
                  >
                    <Download size={14} />
                    JSON
                  </a>
                )}
                <Link
                  href={
                    job.status === "approved" || job.status === "extraction_complete" || job.status.includes("review")
                      ? `/onboarding/${job.id}/review`
                      : `/onboarding/${job.id}/status`
                  }
                  className="cs-btn-ghost text-xs py-1.5"
                >
                  <ArrowRight size={14} />
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import type { OnboardingJob } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { FolderOpen, ArrowRight, Download, Shield } from "lucide-react";

export default function AdminSubmissionsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<OnboardingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/");
      return;
    }
    fetch("/api/admin/submissions")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin]);

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const statusCounts = jobs.reduce(
    (acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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

  if (authLoading || (!isAdmin && !authLoading)) {
    return <div className="flex justify-center py-16"><Spinner size={28} /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-cs-accent-purple" />
          <h1 className="text-2xl font-semibold">All Submissions</h1>
        </div>
        <div className="cs-badge bg-cs-card text-cs-text-secondary">
          {jobs.length} total
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "approved", "review_pending", "extraction_complete", "crawling", "error"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`cs-btn-ghost text-xs py-1.5 px-3 ${
              filter === s ? "bg-cs-card text-cs-text-primary" : ""
            }`}
          >
            {s.replace(/_/g, " ")}
            {s !== "all" && statusCounts[s] ? ` (${statusCounts[s]})` : ""}
            {s === "all" ? ` (${jobs.length})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="cs-card p-12 text-center">
          <FolderOpen size={40} className="mx-auto text-cs-text-muted mb-3" />
          <p className="text-cs-text-secondary">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => (
            <div key={job.id} className="cs-card-hover flex items-center justify-between p-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-cs-text-primary font-medium">{job.property_url}</p>
                  <span className={statusBadge(job.status)}>
                    {job.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-cs-text-muted mt-1">
                  {job.vertical || "unknown"} · {job.pages_crawled} pages · {job.files_processed} files
                  {job.extraction_confidence ? ` · ${Math.round(job.extraction_confidence * 100)}%` : ""}
                  {" · "}
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(job.status === "approved" || job.status === "extraction_complete") && (
                  <a href={`/api/jobs/${job.id}/export`} className="cs-btn-secondary text-xs py-1.5" download>
                    <Download size={14} />
                    JSON
                  </a>
                )}
                <Link
                  href={`/onboarding/${job.id}/review`}
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

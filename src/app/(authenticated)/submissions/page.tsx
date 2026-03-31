"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import type { OnboardingJob } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { FolderOpen, ArrowRight, Download, FileInput, Trash2 } from "lucide-react";

export default function MySubmissionsPage() {
  const { isAdmin } = useAuth();
  const [jobs, setJobs] = useState<OnboardingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  function fetchJobs() {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .finally(() => setLoading(false));
  }

  async function deleteJob(jobId: string, jobName: string) {
    if (!confirm("Delete \"" + jobName + "\" and all its data? This cannot be undone.")) return;
    setDeleting(jobId);
    const res = await fetch("/api/jobs/" + jobId, { method: "DELETE" });
    if (res.ok) {
      setJobs(jobs.filter((j) => j.id !== jobId));
    }
    setDeleting(null);
  }

  function displayName(job: OnboardingJob) {
    if (job.property_name) return job.property_name;
    try { return new URL(job.property_url).hostname; } catch { return job.property_url; }
  }

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
    return "cs-badge " + s.bg + " " + s.text;
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
                  <p className="text-sm text-cs-text-primary font-medium">{displayName(job)}</p>
                  <span className={statusBadge(job.status)}>
                    {job.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-cs-text-muted mt-1">
                  {job.pages_crawled} pages · {job.files_processed} files
                  {job.extraction_confidence ? " · " + Math.round(job.extraction_confidence * 100) + "% confidence" : ""}
                  {" · "}
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {job.status === "approved" && (
                  <a
                    href={"/api/jobs/" + job.id + "/export"}
                    className="cs-btn-secondary text-xs py-1.5"
                    download
                  >
                    <Download size={14} />
                    JSON
                  </a>
                )}
                <Link
                  href={"/onboarding/" + job.id + "/workspace"}
                  className="cs-btn-ghost text-xs py-1.5"
                >
                  <ArrowRight size={14} />
                  View
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => deleteJob(job.id, displayName(job))}
                    disabled={deleting === job.id}
                    className="text-cs-text-muted hover:text-cs-accent-red transition-colors p-1.5"
                    title="Delete workspace"
                  >
                    {deleting === job.id ? <Spinner size={14} /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

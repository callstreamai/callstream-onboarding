"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowRight, Building2, Activity, FileInput, ClipboardCheck, FolderOpen, FileText, Globe } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";

interface Job {
  id: string;
  property_name: string | null;
  property_url: string;
  status: string;
  pages_crawled: number;
  files_processed: number;
  extraction_confidence: number | null;
  created_at: string;
}

interface AdminStats {
  totalProperties: number;
  active: number;
  pendingReview: number;
  completed: number;
  pagesCrawled: number;
  filesProcessed: number;
  fieldsExtracted: number;
  avgConfidence: number;
}

const STATUS_COLORS: Record<string, string> = {
  extraction_complete: "bg-cs-accent-purple/10 text-cs-accent-purple",
  approved:            "bg-cs-accent-green/10 text-cs-accent-green",
  review_in_progress:  "bg-cs-accent-blue/10 text-cs-accent-blue",
  review_pending:      "bg-cs-accent-orange/10 text-cs-accent-orange",
};

const STATUS_LABELS: Record<string, string> = {
  extraction_complete: "Extraction Complete",
  approved:            "Approved",
  review_in_progress:  "In Review",
  review_pending:      "Pending Review",
};

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/dashboard/stats")
        .then((r) => r.json())
        .then((data) => { if (!data.error) setAdminStats(data); })
        .finally(() => setLoading(false));
    } else {
      fetch("/api/jobs")
        .then((r) => r.json())
        .then((data) => setJobs(data.jobs || []))
        .finally(() => setLoading(false));
    }
  }, [isAdmin]);

  function displayName(job: Job) {
    if (job.property_name) return job.property_name;
    try { return new URL(job.property_url).hostname; } catch { return job.property_url; }
  }

  // ── CLIENT VIEW ──
  if (!isAdmin) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Welcome{profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}</h1>
          <p className="text-sm text-cs-text-muted mt-1">Here's the current status of your onboarding with Call Stream AI.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : jobs.length === 0 ? (
          <div className="cs-card p-12 text-center">
            <Building2 size={40} className="mx-auto text-cs-text-muted mb-3" />
            <p className="text-cs-text-secondary font-medium">No projects assigned yet</p>
            <p className="text-sm text-cs-text-muted mt-1">Your Call Stream AI team will add your property shortly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const statusClass = STATUS_COLORS[job.status] || "bg-cs-card text-cs-text-muted";
              const statusLabel = STATUS_LABELS[job.status] || job.status.replace(/_/g, " ");
              return (
                <div key={job.id} className="cs-card p-6">
                  {/* Property header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Building2 size={18} className="text-cs-accent-blue" />
                        <h2 className="text-lg font-semibold text-cs-text-primary">{displayName(job)}</h2>
                      </div>
                      <a href={job.property_url} target="_blank" rel="noreferrer"
                        className="text-xs text-cs-text-muted hover:text-cs-accent-blue transition flex items-center gap-1">
                        <Globe size={11} />{job.property_url}
                      </a>
                    </div>
                    <span className={"cs-badge " + statusClass}>{statusLabel}</span>
                  </div>

                  {/* Progress stats */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="cs-card p-3 text-center">
                      <p className="text-xl font-semibold text-cs-text-primary">{job.pages_crawled}</p>
                      <p className="text-[10px] text-cs-text-muted mt-0.5">Pages Crawled</p>
                    </div>
                    <div className="cs-card p-3 text-center">
                      <p className="text-xl font-semibold text-cs-text-primary">{job.files_processed}</p>
                      <p className="text-[10px] text-cs-text-muted mt-0.5">Files Processed</p>
                    </div>
                    <div className="cs-card p-3 text-center">
                      <p className="text-xl font-semibold text-cs-accent-purple">
                        {job.extraction_confidence ? Math.round(job.extraction_confidence * 100) + "%" : "—"}
                      </p>
                      <p className="text-[10px] text-cs-text-muted mt-0.5">AI Confidence</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <Link href={"/onboarding/" + job.id + "/status"}
                      className="cs-btn-primary text-sm flex-1 justify-center">
                      <Activity size={14} />
                      View Status
                    </Link>
                    <Link href={"/onboarding/" + job.id + "/workspace"}
                      className="cs-btn-secondary text-sm flex-1 justify-center">
                      <FolderOpen size={14} />
                      Workspace
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── ADMIN VIEW ──
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-cs-text-secondary mb-6">
        Welcome back{profile?.full_name ? ", " + profile.full_name : ""}
      </p>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : adminStats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Properties" value={adminStats.totalProperties} />
            <StatCard label="Onboarding Active" value={adminStats.active} color="blue" />
            <StatCard label="Pending Review" value={adminStats.pendingReview} color="orange" />
            <StatCard label="Completed" value={adminStats.completed} color="green" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Pages Crawled" value={adminStats.pagesCrawled} />
            <StatCard label="Files Processed" value={adminStats.filesProcessed} />
            <StatCard label="Fields Extracted" value={adminStats.fieldsExtracted} color="purple" />
            <StatCard label="Avg Confidence" value={Math.round(adminStats.avgConfidence * 100) + "%"} color="purple" />
          </div>
          <div className="cs-card p-5">
            <p className="text-sm font-medium mb-4">Quick Actions</p>
            <div className="flex gap-3">
              <Link href="/onboarding" className="cs-btn-secondary text-sm">
                <FileInput size={16} />New Onboarding
              </Link>
              <Link href="/submissions" className="cs-btn-secondary text-sm">
                <FolderOpen size={16} />View Submissions
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

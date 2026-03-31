"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { StatCard } from "@/components/ui/StatCard";
import { Spinner } from "@/components/ui/Spinner";
import {
  FileInput, ClipboardCheck, FileText, FolderOpen, ArrowRight,
  Globe,
} from "lucide-react";

interface Stats {
  totalProperties: number;
  active: number;
  pendingReview: number;
  completed: number;
  pagesCrawled: number;
  filesProcessed: number;
  fieldsExtracted: number;
  avgConfidence: number;
  recentFiles: {
    id: string;
    job_id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    processing_status: string;
    created_at: string;
  }[];
  workspaces: {
    id: string;
    property_url: string;
    property_name: string | null;
    status: string;
    pages_crawled: number;
    files_processed: number;
    created_at: string;
  }[];
}

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .finally(() => setLoading(false));
  }, []);

  function formatSize(bytes: number) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function displayName(w: { property_name: string | null; property_url: string }) {
    if (w.property_name) return w.property_name;
    try { return new URL(w.property_url).hostname; } catch { return w.property_url; }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-cs-text-secondary mb-6">
        Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="TOTAL PROPERTIES" value={stats?.totalProperties ?? 0} />
            <StatCard label="ONBOARDING ACTIVE" value={stats?.active ?? 0} color="blue" />
            <StatCard label="PENDING REVIEW" value={stats?.pendingReview ?? 0} color="orange" />
            <StatCard label="COMPLETED" value={stats?.completed ?? 0} color="green" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatCard label="PAGES CRAWLED" value={stats?.pagesCrawled ?? 0} />
            <StatCard label="FILES PROCESSED" value={stats?.filesProcessed ?? 0} />
            <StatCard label="FIELDS EXTRACTED" value={stats?.fieldsExtracted ?? 0} color="purple" />
            <StatCard label="AVG CONFIDENCE" value={(stats?.avgConfidence ?? 0) + "%"} color="cyan" />
          </div>

          {/* My Workspaces */}
          {stats?.workspaces && stats.workspaces.length > 0 && (
            <div className="cs-card p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="cs-label">MY WORKSPACES</p>
                <Link href="/submissions" className="text-xs text-cs-accent-blue hover:underline">View all</Link>
              </div>
              <div className="space-y-2">
                {stats.workspaces.slice(0, 5).map((w) => (
                  <Link
                    key={w.id}
                    href={"/onboarding/" + w.id + "/workspace"}
                    className="flex items-center gap-3 py-3 px-4 bg-cs-surface border border-cs-border rounded-md hover:border-cs-accent-blue/50 transition group"
                  >
                    <div className="w-8 h-8 rounded-md bg-cs-accent-blue/10 flex items-center justify-center flex-shrink-0">
                      <Globe size={16} className="text-cs-accent-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cs-text-primary font-medium truncate">
                        {displayName(w)}
                      </p>
                      <p className="text-[10px] text-cs-text-muted">
                        {w.pages_crawled} pages · {w.files_processed} files · {new Date(w.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-cs-text-muted group-hover:text-cs-accent-blue transition flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent documents */}
          {stats?.recentFiles && stats.recentFiles.length > 0 && (
            <div className="cs-card p-5 mb-6">
              <p className="cs-label mb-3">RECENT DOCUMENTS</p>
              <div className="space-y-2">
                {stats.recentFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2 px-3 bg-cs-surface rounded-md border border-cs-border">
                    <FileText size={14} className="text-cs-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-cs-text-primary truncate">{f.file_name}</p>
                      <p className="text-[10px] text-cs-text-muted">
                        {f.file_type} · {formatSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={"text-[10px] px-2 py-0.5 rounded " + (
                      f.processing_status === "complete"
                        ? "bg-cs-accent-green/10 text-cs-accent-green"
                        : f.processing_status === "failed"
                        ? "bg-cs-accent-red/10 text-cs-accent-red"
                        : "bg-cs-card text-cs-text-muted"
                    )}>
                      {f.processing_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="cs-card p-5">
        <p className="cs-label mb-3">QUICK ACTIONS</p>
        <div className="flex gap-3 flex-wrap">
          {stats?.workspaces && stats.workspaces.length > 0 && (
            <Link href={"/onboarding/" + stats.workspaces[0].id + "/workspace"} className="cs-btn-primary text-sm">
              <FolderOpen size={16} />
              Open Workspace
            </Link>
          )}
          <Link href="/onboarding" className="cs-btn-secondary text-sm">
            <FileInput size={16} />
            New Onboarding
          </Link>
          <Link href={isAdmin ? "/admin/submissions" : "/submissions"} className="cs-btn-secondary text-sm">
            <ClipboardCheck size={16} />
            View Submissions
          </Link>
        </div>
      </div>
    </div>
  );
}

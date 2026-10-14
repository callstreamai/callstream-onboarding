"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowRight, Building2, Activity, FileInput, ClipboardCheck, FolderOpen, FileText, Globe, Kanban, Mic2 } from "lucide-react";
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

interface WordItem {
  text: string;
  weight: number;
}

const STATUS_COLORS: Record<string, string> = {
  extraction_complete: "bg-cs-accent-purple/10 text-cs-accent-purple",
  approved:            "bg-cs-accent-green/10 text-cs-accent-green",
  review_in_progress:  "bg-cs-accent-brand/10 text-cs-accent-brand",
  review_pending:      "bg-cs-accent-orange/10 text-cs-accent-orange",
};

const STATUS_LABELS: Record<string, string> = {
  extraction_complete: "Extraction Complete",
  approved:            "Approved",
  review_in_progress:  "In Review",
  review_pending:      "Pending Review",
};

// Compute AI confidence from data completeness
function computeConfidence(pagesCrawled: number, filesProcessed: number, linksCount: number): number {
  // Max targets: 30 pages, 10 docs, 5 links = 100%
  const pagesScore = Math.min(pagesCrawled / 30, 1) * 0.5;
  const docsScore = Math.min(filesProcessed / 10, 1) * 0.35;
  const linksScore = Math.min(linksCount / 5, 1) * 0.15;
  return pagesScore + docsScore + linksScore;
}

// Simple word cloud component using inline SVG-less approach
function WordCloud({ words }: { words: WordItem[] }) {
  if (!words.length) return null;

  const maxWeight = Math.max(...words.map((w) => w.weight));
  const sizes = ["text-[10px]", "text-xs", "text-sm", "text-base", "text-lg", "text-xl"];
  const colors = [
    "text-cs-accent-brand", "text-cs-accent-purple", "text-cs-accent-green",
    "text-cs-accent-orange", "text-cs-text-secondary",
  ];

  return (
    <div className="cs-card p-5 mt-6">
      <p className="text-xs font-medium text-cs-text-primary mb-4">Workspace Word Cloud</p>
      <p className="text-[11px] text-cs-text-muted mb-4">
        Words from your uploaded documents and links — the more data, the better your AI model.
      </p>
      <div className="flex flex-wrap gap-2 items-center justify-center py-2">
        {words.map((word, i) => {
          const ratio = word.weight / maxWeight;
          const sizeIdx = Math.min(Math.floor(ratio * sizes.length), sizes.length - 1);
          const colorIdx = i % colors.length;
          return (
            <span
              key={word.text + i}
              className={`${sizes[sizeIdx]} ${colors[colorIdx]} font-medium opacity-${Math.max(40, Math.floor(ratio * 100))} transition-all`}
              style={{ opacity: 0.4 + ratio * 0.6 }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordItems, setWordItems] = useState<WordItem[]>([]);
  const [linkCounts, setLinkCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/dashboard/stats")
        .then((r) => r.json())
        .then((data) => { if (!data.error) setAdminStats(data); })
        .finally(() => setLoading(false));
    } else {
      fetch("/api/jobs")
        .then((r) => r.json())
        .then(async (data) => {
          const fetchedJobs: Job[] = data.jobs || [];
          setJobs(fetchedJobs);


        })
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
          <>
            <div className="space-y-4">
              {jobs.map((job) => {
                const statusClass = STATUS_COLORS[job.status] || "bg-cs-card text-cs-text-muted";
                const statusLabel = job.status === "approved" ? "Ready" : "In preparation";
                const links = linkCounts[job.id] || 0;
                const confidence = computeConfidence(job.pages_crawled || 0, job.files_processed || 0, links);
                return (
                  <div key={job.id} className="cs-card p-6">
                    {/* Property header */}
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <Building2 size={18} className="text-cs-accent-brand" />
                          <h2 className="text-lg font-semibold text-cs-text-primary">{displayName(job)}</h2>
                        </div>
                        <a href={job.property_url} target="_blank" rel="noreferrer"
                          className="text-xs text-cs-text-muted hover:text-cs-accent-brand transition flex items-center gap-1">
                          <Globe size={11} />{job.property_url}
                        </a>
                      </div>
                      <span className={"cs-badge " + statusClass}>{statusLabel}</span>
                    </div>

                    <p className="text-sm text-cs-text-secondary mb-5">Add your property files and submit them for review. Your Call Stream team handles preparation.</p>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-3">
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
                      <Link href={"/onboarding/" + job.id + "/project"}
                        className="cs-btn-secondary text-sm flex-1 justify-center">
                        <Kanban size={14} />
                        Project
                      </Link>
                      <Link href={"/onboarding/" + job.id + "/voice-preview"}
                        className="cs-btn-secondary text-sm flex-1 justify-center">
                        <Mic2 size={14} />
                        Voice
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Word Cloud */}

          </>
        )}
      </div>
    );
  }

  // ── ADMIN VIEW ──
  return (
    <div>
      <p className="cs-label text-cs-accent-brand mb-2">CALL STREAM AI / LAUNCH</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Your launch workspace</h1>
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
            <StatCard label="Avg Confidence" value={Math.round(adminStats.avgConfidence) + "%"} color="purple" />
          </div>
          <div className="cs-card p-5">
            <p className="text-sm font-medium mb-4">Quick Actions</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/onboarding" className="cs-btn-secondary text-sm">
                <FileInput size={16} />Start onboarding
              </Link>
              <Link href="/submissions" className="cs-btn-secondary text-sm">
                <FolderOpen size={16} />View projects
              </Link>
              <Link href="/voice-preview" className="cs-btn-primary text-sm"><Mic2 size={16} />Explore Voice Studio</Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

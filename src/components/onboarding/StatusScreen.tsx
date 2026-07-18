"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OnboardingJob } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import {
  FolderOpen,
  MessageSquare,
  Kanban,
  Mic2,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  ArrowRight,
  Activity,
} from "lucide-react";

interface Props {
  jobId: string;
}

interface Milestone {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "complete" | "skipped";
  target_date: string | null;
}

interface RecentComment {
  id: string;
  body: string;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
}

interface WorkspaceSummary {
  spaces: number;
  documents: number;
  links: number;
}

export function StatusScreen({ jobId }: Props) {
  const [job, setJob] = useState<OnboardingJob | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSummary>({ spaces: 0, documents: 0, links: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [jobId]);

  async function loadAll() {
    try {
      const [jobRes, projectRes, commentsRes, spacesRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}/project`),
        fetch(`/api/jobs/${jobId}/comments`),
        fetch(`/api/jobs/${jobId}/spaces`),
      ]);

      if (jobRes.ok) {
        const d = await jobRes.json();
        setJob(d.job);
      }
      if (projectRes.ok) {
        const d = await projectRes.json();
        setMilestones(d.milestones || []);
      }
      if (commentsRes.ok) {
        const d = await commentsRes.json();
        const all = d.comments || [];
        setRecentComments(all.slice(-3).reverse());
      }
      if (spacesRes.ok) {
        const d = await spacesRes.json();
        const spaces = d.spaces || [];
        const docs = spaces.reduce((n: number, s: any) => n + (s.space_documents?.length || 0), 0);
        setWorkspace({ spaces: spaces.length, documents: docs, links: 0 });
      }
    } finally {
      setLoading(false);
    }
  }

  function formatTime(date: string) {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return diff + "m ago";
    if (diff < 1440) return Math.floor(diff / 60) + "h ago";
    return Math.floor(diff / 1440) + "d ago";
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
        <p className="text-cs-text-secondary">Project not found</p>
      </div>
    );
  }

  // Milestone progress
  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === "complete").length;
  const inProgress = milestones.filter((m) => m.status === "in_progress").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextMilestone = milestones.find((m) => m.status === "in_progress") ||
    milestones.find((m) => m.status === "pending");

  // Status pill
  const statusLabel = job.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isActive = !["approved", "rejected", "error"].includes(job.status);

  return (
    <div className="space-y-6">

      {/* Hero header */}
      <div className="cs-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-cs-text-primary truncate">
              {job.property_name || job.property_url}
            </h1>
            {job.property_name && (
              <a
                href={job.property_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-cs-text-muted hover:text-cs-accent-blue mt-1 transition"
              >
                <Globe size={11} />
                {job.property_url}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          <div className={
            "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium " +
            (job.status === "approved"
              ? "bg-cs-accent-green/10 text-cs-accent-green"
              : job.status === "error" || job.status === "rejected"
              ? "bg-cs-accent-red/10 text-cs-accent-red"
              : "bg-cs-accent-blue/10 text-cs-accent-blue")
          }>
            <span className={"w-1.5 h-1.5 rounded-full " + (isActive ? "bg-cs-accent-blue animate-pulse" : "bg-cs-accent-green")} />
            {statusLabel}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-cs-text-muted">Overall Progress</span>
            <span className="text-sm font-semibold text-cs-accent-green">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-cs-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cs-accent-blue to-cs-accent-green rounded-full transition-all duration-700"
              style={{ width: pct + "%" }}
            />
          </div>
          <p className="text-[11px] text-cs-text-muted mt-1.5">
            {completed} of {total} milestones complete
            {inProgress > 0 && ` · ${inProgress} in progress`}
          </p>
        </div>
      </div>

      {/* 3-column summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Workspace card */}
        <Link
          href={`/onboarding/${jobId}/workspace`}
          className="cs-card p-5 hover:border-cs-accent-blue/40 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cs-accent-purple/10 flex items-center justify-center">
              <FolderOpen size={16} className="text-cs-accent-purple" />
            </div>
            <ArrowRight size={14} className="text-cs-text-muted group-hover:text-cs-accent-blue transition" />
          </div>
          <h3 className="text-sm font-medium text-cs-text-primary mb-1">Workspace</h3>
          <p className="text-xs text-cs-text-muted">
            {workspace.spaces > 0
              ? `${workspace.spaces} space${workspace.spaces !== 1 ? "s" : ""} · ${workspace.documents} document${workspace.documents !== 1 ? "s" : ""}`
              : "Upload documents, links & media"}
          </p>
          {workspace.documents === 0 && (
            <p className="text-[11px] text-cs-accent-blue mt-2">
              Add files to get started →
            </p>
          )}
        </Link>

        {/* Project / Timeline card */}
        <Link
          href={`/onboarding/${jobId}/project`}
          className="cs-card p-5 hover:border-cs-accent-blue/40 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cs-accent-blue/10 flex items-center justify-center">
              <Kanban size={16} className="text-cs-accent-blue" />
            </div>
            <ArrowRight size={14} className="text-cs-text-muted group-hover:text-cs-accent-blue transition" />
          </div>
          <h3 className="text-sm font-medium text-cs-text-primary mb-1">Project</h3>
          {nextMilestone ? (
            <p className="text-xs text-cs-text-muted">
              Up next: <span className="text-cs-text-secondary">{nextMilestone.name}</span>
            </p>
          ) : (
            <p className="text-xs text-cs-text-muted">Milestones, tasks & timeline</p>
          )}
          <p className="text-[11px] text-cs-accent-green mt-2">{pct}% complete</p>
        </Link>

        {/* Voice Preview card */}
        <Link
          href={`/onboarding/${jobId}/voice-preview`}
          className="cs-card p-5 hover:border-cs-accent-blue/40 transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cs-accent-green/10 flex items-center justify-center">
              <Mic2 size={16} className="text-cs-accent-green" />
            </div>
            <ArrowRight size={14} className="text-cs-text-muted group-hover:text-cs-accent-blue transition" />
          </div>
          <h3 className="text-sm font-medium text-cs-text-primary mb-1">Voice Preview</h3>
          <p className="text-xs text-cs-text-muted">Hear how your AI voice sounds</p>
        </Link>
      </div>

      {/* Milestone progress list + Recent comments — 2 col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Milestones */}
        <div className="cs-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-cs-text-muted uppercase tracking-wide">Milestones</h3>
            <Link
              href={`/onboarding/${jobId}/project`}
              className="text-[11px] text-cs-accent-blue hover:underline"
            >
              View all
            </Link>
          </div>

          {milestones.length === 0 ? (
            <p className="text-xs text-cs-text-muted py-4 text-center">No milestones yet</p>
          ) : (
            <div className="space-y-2">
              {milestones.slice(0, 6).map((m) => {
                const Icon =
                  m.status === "complete" ? CheckCircle2
                  : m.status === "in_progress" ? Clock
                  : Circle;
                const color =
                  m.status === "complete" ? "text-cs-accent-green"
                  : m.status === "in_progress" ? "text-cs-accent-blue"
                  : "text-cs-border";
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <Icon size={14} className={"flex-shrink-0 " + color} />
                    <span className={
                      "text-xs flex-1 " +
                      (m.status === "complete"
                        ? "text-cs-text-muted line-through"
                        : m.status === "in_progress"
                        ? "text-cs-text-primary font-medium"
                        : "text-cs-text-secondary")
                    }>
                      {m.name}
                    </span>
                    {m.status === "in_progress" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cs-accent-blue/10 text-cs-accent-blue font-medium">
                        ACTIVE
                      </span>
                    )}
                  </div>
                );
              })}
              {milestones.length > 6 && (
                <p className="text-[11px] text-cs-text-muted pt-1">
                  +{milestones.length - 6} more
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent comments */}
        <div className="cs-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-cs-text-muted uppercase tracking-wide">Recent Comments</h3>
            <Link
              href={`/onboarding/${jobId}/project`}
              className="text-[11px] text-cs-accent-blue hover:underline"
            >
              View all
            </Link>
          </div>

          {recentComments.length === 0 ? (
            <div className="py-4 text-center">
              <MessageSquare size={20} className="mx-auto text-cs-text-muted mb-2" />
              <p className="text-xs text-cs-text-muted">No comments yet</p>
              <Link
                href={`/onboarding/${jobId}/project`}
                className="text-[11px] text-cs-accent-blue hover:underline mt-1 inline-block"
              >
                Start a conversation →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentComments.map((c) => {
                const name = c.author_name || c.author_email || "Unknown";
                const initial = name[0].toUpperCase();
                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-cs-accent-blue/20 flex items-center justify-center text-[10px] text-cs-accent-blue font-semibold flex-shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-medium text-cs-text-primary">{name}</span>
                        <span className="text-[10px] text-cs-text-muted">{formatTime(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-cs-text-secondary line-clamp-2">
                        {c.body.split(/(@\S+)/g).map((part, i) =>
                          part.startsWith("@") ? (
                            <span key={i} className="text-cs-accent-blue">{part}</span>
                          ) : part
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

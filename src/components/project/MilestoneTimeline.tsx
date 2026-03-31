"use client";

import { useState } from "react";
import { Milestone, MilestoneStatus } from "@/types/project";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  Plus,
  CalendarDays,
  ChevronDown,
} from "lucide-react";

interface Props {
  milestones: Milestone[];
  jobId: string;
  isAdmin: boolean;
  onUpdate: () => void;
}

const STATUS_ICON: Record<MilestoneStatus, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  complete: CheckCircle2,
  skipped: SkipForward,
};

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: "text-cs-text-muted border-cs-border",
  in_progress: "text-cs-accent-blue border-cs-accent-blue",
  complete: "text-cs-accent-green border-cs-accent-green",
  skipped: "text-cs-text-muted border-cs-border opacity-50",
};

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "skipped", label: "Skipped" },
];

export default function MilestoneTimeline({ milestones, jobId, isAdmin, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");

  const supabase = createClient();

  async function getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || "";
  }

  async function updateMilestone(id: string, updates: Partial<Milestone>) {
    const userId = await getUserId();
    await fetch("/api/jobs/" + jobId + "/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ milestoneId: id, ...updates }),
    });
    onUpdate();
    setEditingId(null);
  }

  async function addMilestone() {
    if (!newName.trim()) return;
    const userId = await getUserId();
    await fetch("/api/jobs/" + jobId + "/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({
        name: newName,
        description: newDesc || null,
        target_date: newDate || null,
        sort_order: milestones.length,
      }),
    });
    setNewName("");
    setNewDesc("");
    setNewDate("");
    setShowAdd(false);
    onUpdate();
  }

  // Calculate progress
  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === "complete").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="cs-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cs-text-muted uppercase tracking-wide">Progress</span>
          <span className="text-sm font-medium text-cs-accent-green">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-cs-border rounded-full overflow-hidden">
          <div
            className="h-full bg-cs-accent-green rounded-full transition-all duration-500"
            style={{ width: pct + "%" }}
          />
        </div>
        <p className="text-xs text-cs-text-muted mt-2">
          {completed} of {total} milestones complete
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {milestones.map((m, i) => {
          const Icon = STATUS_ICON[m.status];
          const colors = STATUS_COLORS[m.status];
          const isLast = i === milestones.length - 1;
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className="flex gap-4 relative">
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-cs-border" />
              )}

              {/* Icon */}
              <div className={"flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-cs-bg " + colors}>
                <Icon size={14} />
              </div>

              {/* Content */}
              <div className={"flex-1 pb-8 " + (m.status === "skipped" ? "opacity-50" : "")}>
                <div className="cs-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-cs-text-primary">{m.name}</h3>
                      {m.description && (
                        <p className="text-xs text-cs-text-muted mt-0.5">{m.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-cs-text-muted">
                        {m.target_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays size={10} /> Target: {m.target_date}
                          </span>
                        )}
                        {m.completed_at && (
                          <span className="text-cs-accent-green">
                            Completed: {new Date(m.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin controls */}
                    {isAdmin && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setEditingId(isEditing ? null : m.id)}
                          className="text-cs-text-muted hover:text-cs-text-secondary"
                        >
                          <ChevronDown size={14} />
                        </button>

                        {isEditing && (
                          <div className="absolute right-0 top-6 z-10 bg-cs-card border border-cs-border rounded-lg shadow-lg p-3 w-48 space-y-2">
                            <p className="text-[10px] text-cs-text-muted uppercase tracking-wide">Status</p>
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updateMilestone(m.id, { status: opt.value })}
                                className={
                                  "block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-cs-border/50 " +
                                  (m.status === opt.value ? "text-cs-accent-blue" : "text-cs-text-secondary")
                                }
                              >
                                {opt.label}
                              </button>
                            ))}
                            <hr className="border-cs-border" />
                            <div>
                              <p className="text-[10px] text-cs-text-muted uppercase tracking-wide mb-1">Target date</p>
                              <input
                                type="date"
                                defaultValue={m.target_date || ""}
                                onChange={(e) => updateMilestone(m.id, { target_date: e.target.value || null } as any)}
                                className="cs-input text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add milestone (admin only) */}
      {isAdmin && (
        <div>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs text-cs-accent-blue hover:underline"
            >
              <Plus size={12} /> Add milestone
            </button>
          ) : (
            <div className="cs-card p-4 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Milestone name"
                className="cs-input"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="cs-input"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="cs-input"
              />
              <div className="flex gap-2">
                <button onClick={addMilestone} className="cs-btn-primary text-xs px-3 py-1.5">
                  Add
                </button>
                <button onClick={() => setShowAdd(false)} className="text-xs text-cs-text-muted hover:text-cs-text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

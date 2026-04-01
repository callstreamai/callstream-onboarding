"use client";

import { useState } from "react";
import { Milestone, MilestoneStatus } from "@/types/project";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2, Circle, Clock, SkipForward, Plus, CalendarDays,
  ChevronDown, Trash2, ChevronRight,
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
  const [menuId, setMenuId] = useState<string | null>(null);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");

  const supabase = createClient();

  async function getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || "";
  }

  async function updateMilestone(id: string, updates: Record<string, any>) {
    const userId = await getUserId();
    await fetch("/api/jobs/" + jobId + "/milestones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ milestoneId: id, ...updates }),
    });
    setMenuId(null);
    onUpdate();
  }

  async function toggleComplete(m: Milestone) {
    if (m.status === "complete") {
      await updateMilestone(m.id, { status: "pending", completed_at: null });
    } else {
      await updateMilestone(m.id, { status: "complete" });
    }
  }

  async function deleteMilestone(id: string) {
    if (!confirm("Delete this milestone?")) return;
    const userId = await getUserId();
    await fetch("/api/jobs/" + jobId + "/milestones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ milestoneId: id }),
    });
    setMenuId(null);
    onUpdate();
  }

  async function addMilestone(parentId: string | null) {
    if (!newName.trim()) return;
    const userId = await getUserId();
    await fetch("/api/jobs/" + jobId + "/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({
        name: newName,
        description: newDesc || null,
        target_date: newDate || null,
        parent_id: parentId,
        sort_order: milestones.length,
      }),
    });
    setNewName("");
    setNewDesc("");
    setNewDate("");
    setShowAddRoot(false);
    setAddingSubFor(null);
    onUpdate();
  }

  // Build tree: top-level + children
  const rootMilestones = milestones.filter((m) => !m.parent_id);
  const childMap: Record<string, Milestone[]> = {};
  for (const m of milestones) {
    if (m.parent_id) {
      if (!childMap[m.parent_id]) childMap[m.parent_id] = [];
      childMap[m.parent_id].push(m);
    }
  }

  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === "complete").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  function renderAddForm(parentId: string | null) {
    return (
      <div className="cs-card p-4 space-y-2 mt-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder={parentId ? "Sub-milestone name" : "Milestone name"} className="cs-input text-xs" />
        <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description (optional)" className="cs-input text-xs" />
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="cs-input text-xs" />
        <div className="flex gap-2">
          <button onClick={() => addMilestone(parentId)} className="cs-btn-primary text-xs px-3 py-1">Add</button>
          <button onClick={() => { setShowAddRoot(false); setAddingSubFor(null); setNewName(""); setNewDesc(""); setNewDate(""); }}
            className="text-xs text-cs-text-muted">Cancel</button>
        </div>
      </div>
    );
  }

  function renderMilestone(m: Milestone, isChild: boolean, isLast: boolean) {
    const Icon = STATUS_ICON[m.status];
    const colors = STATUS_COLORS[m.status];
    const children = childMap[m.id] || [];
    const isMenuOpen = menuId === m.id;

    return (
      <div key={m.id} className={"flex gap-3 relative " + (isChild ? "ml-10" : "")}>
        {/* Vertical line */}
        {!isLast && !isChild && (
          <div className="absolute left-[13px] top-7 bottom-0 w-px bg-cs-border" />
        )}

        {/* Status icon — clickable for admins */}
        <button
          onClick={() => { if (isAdmin) toggleComplete(m); }}
          disabled={!isAdmin}
          className={"flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-cs-bg transition " +
            colors + (isAdmin ? " cursor-pointer hover:scale-110" : "")}
          title={isAdmin ? (m.status === "complete" ? "Mark incomplete" : "Mark complete") : ""}
        >
          <Icon size={13} />
        </button>

        {/* Content */}
        <div className={"flex-1 " + (isChild ? "pb-3" : "pb-6") + (m.status === "skipped" ? " opacity-50" : "")}>
          <div className="cs-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className={"text-sm font-medium " +
                  (m.status === "complete" ? "text-cs-accent-green line-through" : "text-cs-text-primary")}>
                  {m.name}
                </h3>
                {m.description && (
                  <p className="text-[11px] text-cs-text-muted mt-0.5">{m.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-cs-text-muted">
                  {m.target_date && (
                    <span className="flex items-center gap-1"><CalendarDays size={9} /> {m.target_date}</span>
                  )}
                  {m.completed_at && (
                    <span className="text-cs-accent-green">
                      Completed {new Date(m.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Admin menu */}
              {isAdmin && (
                <div className="relative flex-shrink-0">
                  <button onClick={() => setMenuId(isMenuOpen ? null : m.id)}
                    className="text-cs-text-muted hover:text-cs-text-secondary p-1">
                    <ChevronDown size={13} />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-7 z-20 bg-cs-card border border-cs-border rounded-lg shadow-lg p-2 w-44 space-y-1">
                      <p className="text-[9px] text-cs-text-muted uppercase tracking-wide px-2 pb-1">Status</p>
                      {STATUS_OPTIONS.map((opt) => (
                        <button key={opt.value}
                          onClick={() => updateMilestone(m.id, { status: opt.value })}
                          className={"block w-full text-left text-xs px-2 py-1 rounded hover:bg-cs-border/50 " +
                            (m.status === opt.value ? "text-cs-accent-blue font-medium" : "text-cs-text-secondary")}>
                          {opt.label}
                        </button>
                      ))}
                      <hr className="border-cs-border my-1" />
                      <div className="px-2 pb-1">
                        <p className="text-[9px] text-cs-text-muted uppercase tracking-wide mb-1">Target date</p>
                        <input type="date" defaultValue={m.target_date || ""}
                          onChange={(e) => updateMilestone(m.id, { target_date: e.target.value || null })}
                          className="cs-input text-xs" />
                      </div>
                      <hr className="border-cs-border my-1" />
                      <button onClick={() => { setAddingSubFor(m.id); setMenuId(null); }}
                        className="flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 rounded hover:bg-cs-border/50 text-cs-text-secondary">
                        <Plus size={11} /> Add sub-milestone
                      </button>
                      <button onClick={() => deleteMilestone(m.id)}
                        className="flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 rounded hover:bg-cs-accent-red/10 text-cs-accent-red">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sub-milestones */}
          {children.length > 0 && (
            <div className="mt-2 space-y-1">
              {children.map((child, ci) => renderMilestone(child, true, ci === children.length - 1))}
            </div>
          )}

          {/* Add sub-milestone form */}
          {addingSubFor === m.id && renderAddForm(m.id)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="cs-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cs-text-muted uppercase tracking-wide">Progress</span>
          <span className="text-sm font-medium text-cs-accent-green">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-cs-border rounded-full overflow-hidden">
          <div className="h-full bg-cs-accent-green rounded-full transition-all duration-500"
            style={{ width: pct + "%" }} />
        </div>
        <p className="text-xs text-cs-text-muted mt-2">
          {completed} of {total} milestones complete
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {rootMilestones.map((m, i) => renderMilestone(m, false, i === rootMilestones.length - 1))}
      </div>

      {/* Add root milestone */}
      {isAdmin && (
        <div>
          {showAddRoot ? renderAddForm(null) : (
            <button onClick={() => setShowAddRoot(true)}
              className="flex items-center gap-1.5 text-xs text-cs-accent-blue hover:underline">
              <Plus size={12} /> Add milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

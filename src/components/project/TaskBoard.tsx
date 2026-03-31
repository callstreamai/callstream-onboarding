"use client";

import { useState } from "react";
import { Task, Milestone, TaskStatus, TaskPriority } from "@/types/project";
import {
  Plus,
  Calendar,
  User,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Trash2,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface Props {
  tasks: Task[];
  milestones: Milestone[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  jobId: string;
  isAdmin: boolean;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<TaskStatus, { icon: typeof Circle; color: string; label: string }> = {
  todo: { icon: Circle, color: "text-cs-text-muted", label: "To Do" },
  in_progress: { icon: Clock, color: "text-cs-accent-blue", label: "In Progress" },
  done: { icon: CheckCircle2, color: "text-cs-accent-green", label: "Done" },
  cancelled: { icon: XCircle, color: "text-cs-text-muted opacity-50", label: "Cancelled" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  low: { color: "text-cs-text-muted", label: "Low" },
  medium: { color: "text-cs-accent-blue", label: "Medium" },
  high: { color: "text-cs-accent-yellow", label: "High" },
  urgent: { color: "text-cs-accent-red", label: "Urgent" },
};

export default function TaskBoard({ tasks, milestones, users, currentUser, jobId, isAdmin, onUpdate }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [milestone, setMilestone] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "open">("all");

  async function createTask() {
    if (!title.trim()) return;
    await fetch("/api/jobs/" + jobId + "/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        assigned_to: assignee || null,
        created_by: currentUser?.id || null,
        milestone_id: milestone || null,
        priority,
        due_date: dueDate || null,
      }),
    });
    setTitle("");
    setDescription("");
    setAssignee("");
    setMilestone("");
    setPriority("medium");
    setDueDate("");
    setShowAdd(false);
    onUpdate();
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    await fetch("/api/jobs/" + jobId + "/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...updates }),
    });
    onUpdate();
  }

  async function deleteTask(taskId: string) {
    await fetch("/api/jobs/" + jobId + "/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    onUpdate();
  }

  const filtered = tasks.filter((t) => {
    if (filter === "mine") return t.assigned_to === currentUser?.id;
    if (filter === "open") return t.status === "todo" || t.status === "in_progress";
    return true;
  });

  const isOverdue = (t: Task) => {
    if (!t.due_date || t.status === "done" || t.status === "cancelled") return false;
    return new Date(t.due_date) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "open", "mine"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1 text-xs rounded-md " +
                (filter === f
                  ? "bg-cs-accent-blue/10 text-cs-accent-blue"
                  : "text-cs-text-muted hover:text-cs-text-secondary")
              }
            >
              {f === "all" ? "All" : f === "open" ? "Open" : "My Tasks"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 text-xs text-cs-accent-blue hover:underline"
        >
          <Plus size={12} /> New task
        </button>
      </div>

      {/* New task form */}
      {showAdd && (
        <div className="cs-card p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="cs-input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="cs-input h-16 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="cs-label block mb-1">ASSIGNEE</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="cs-input">
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="cs-label block mb-1">MILESTONE</label>
              <select value={milestone} onChange={(e) => setMilestone(e.target.value)} className="cs-input">
                <option value="">None</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cs-label block mb-1">PRIORITY</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="cs-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="cs-label block mb-1">DUE DATE</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="cs-input" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createTask} className="cs-btn-primary text-xs px-3 py-1.5">Create task</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-cs-text-muted hover:text-cs-text-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-cs-text-muted text-sm">
          No tasks yet. Click "New task" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const st = STATUS_CONFIG[task.status];
            const pr = PRIORITY_CONFIG[task.priority];
            const StatusIcon = st.icon;
            const overdue = isOverdue(task);

            return (
              <div key={task.id} className="cs-card p-4">
                <div className="flex items-start gap-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => {
                      const next: Record<TaskStatus, TaskStatus> = {
                        todo: "in_progress",
                        in_progress: "done",
                        done: "todo",
                        cancelled: "todo",
                      };
                      updateTask(task.id, { status: next[task.status] });
                    }}
                    className={"mt-0.5 " + st.color}
                  >
                    <StatusIcon size={16} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={
                        "text-sm font-medium " +
                        (task.status === "done" ? "line-through text-cs-text-muted" : "text-cs-text-primary")
                      }>
                        {task.title}
                      </h4>
                      <span className={"text-[10px] " + pr.color}>
                        <Flag size={10} className="inline mr-0.5" />{pr.label}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-cs-text-muted mt-0.5 line-clamp-1">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-cs-text-muted flex-wrap">
                      {task.assignee_name && (
                        <span className="flex items-center gap-1">
                          <User size={10} /> {task.assignee_name}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={"flex items-center gap-1 " + (overdue ? "text-cs-accent-red" : "")}>
                          <Calendar size={10} /> {task.due_date}
                          {overdue && " (overdue)"}
                        </span>
                      )}
                      {task.milestone_id && (
                        <span className="text-cs-accent-purple">
                          {milestones.find((m) => m.id === task.milestone_id)?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete — only creator or admin */}
                  {(isAdmin || task.created_by === currentUser?.id) && (
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-cs-text-muted hover:text-cs-accent-red flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Milestone,
  Task,
  Comment,
  DEFAULT_MILESTONES,
} from "@/types/project";
import MilestoneTimeline from "@/components/project/MilestoneTimeline";
import TaskBoard from "@/components/project/TaskBoard";
import CommentFeed from "@/components/project/CommentFeed";
import NotificationBell from "@/components/project/NotificationBell";
import { Spinner } from "@/components/ui/Spinner";
import {
  LayoutList,
  CheckSquare,
  MessageSquare,
} from "lucide-react";

type Tab = "timeline" | "tasks" | "comments";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function ProjectPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [tab, setTab] = useState<Tab>("timeline");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobName, setJobName] = useState("");

  const supabase = createClient();

  const loadProject = useCallback(async () => {
    const res = await fetch("/api/jobs/" + jobId + "/project");
    if (res.ok) {
      const data = await res.json();
      setMilestones(data.milestones);
      setTasks(data.tasks);
      setComments(data.comments);

      // If no milestones yet and user is admin, initialize defaults
      if (data.milestones.length === 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || "";
        const initRes = await fetch("/api/jobs/" + jobId + "/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ initDefaults: true, milestones: DEFAULT_MILESTONES }),
        });
        if (initRes.ok) {
          const initData = await initRes.json();
          setMilestones(initData.milestones);
        }
      }
    }
    setLoading(false);
  }, [jobId, supabase.auth]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users);
          const me = usersData.users.find((u: UserProfile) => u.id === user.id);
          if (me) {
            setCurrentUser(me);
            setIsAdmin(me.role === "admin");
          }
        }
      }

      const jobRes = await fetch("/api/jobs/" + jobId);
      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJobName(jobData.property_url || jobData.id?.slice(0, 8) || "Project");
      }

      await loadProject();
    }
    init();
  }, [jobId, loadProject, supabase.auth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof LayoutList; count?: number }[] = [
    { key: "timeline", label: "Timeline", icon: LayoutList },
    { key: "tasks", label: "Tasks", icon: CheckSquare, count: tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length },
    { key: "comments", label: "Comments", icon: MessageSquare, count: comments.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-cs-text-primary">
            Project
          </h1>
          <p className="text-sm text-cs-text-muted mt-0.5">
            {jobName}
          </p>
        </div>
        {currentUser && <NotificationBell userId={currentUser.id} />}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-cs-border pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px transition " +
              (tab === t.key
                ? "border-cs-accent-blue text-cs-accent-blue"
                : "border-transparent text-cs-text-muted hover:text-cs-text-secondary")
            }
          >
            <t.icon size={14} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cs-card text-[10px]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "timeline" && (
        <MilestoneTimeline
          milestones={milestones}
          jobId={jobId}
          isAdmin={isAdmin}
          onUpdate={loadProject}
        />
      )}
      {tab === "tasks" && (
        <TaskBoard
          tasks={tasks}
          milestones={milestones}
          users={users}
          currentUser={currentUser}
          jobId={jobId}
          isAdmin={isAdmin}
          onUpdate={loadProject}
        />
      )}
      {tab === "comments" && (
        <CommentFeed
          comments={comments}
          users={users}
          currentUser={currentUser}
          jobId={jobId}
          onUpdate={loadProject}
        />
      )}
    </div>
  );
}

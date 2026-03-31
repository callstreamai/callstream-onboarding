import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET: Fetch full project data (milestones, tasks, comments)
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;

    const [milestonesRes, tasksRes, commentsRes] = await Promise.all([
      supabase
        .from("project_milestones")
        .select("*")
        .eq("job_id", jobId)
        .order("sort_order"),
      supabase
        .from("project_tasks")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_comments")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
    ]);

    // Enrich tasks and comments with user names
    const userIds = new Set<string>();
    for (const t of tasksRes.data || []) {
      if (t.assigned_to) userIds.add(t.assigned_to);
      if (t.created_by) userIds.add(t.created_by);
    }
    for (const c of commentsRes.data || []) {
      if (c.author_id) userIds.add(c.author_id);
    }

    let profiles: Record<string, { full_name: string; email: string }> = {};
    if (userIds.size > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(userIds));
      for (const p of profileData || []) {
        profiles[p.id] = { full_name: p.full_name || "", email: p.email };
      }
    }

    const tasks = (tasksRes.data || []).map((t) => ({
      ...t,
      assignee_name: t.assigned_to ? profiles[t.assigned_to]?.full_name : null,
      assignee_email: t.assigned_to ? profiles[t.assigned_to]?.email : null,
    }));

    const comments = (commentsRes.data || []).map((c) => ({
      ...c,
      author_name: profiles[c.author_id]?.full_name || "",
      author_email: profiles[c.author_id]?.email || "",
    }));

    return NextResponse.json({
      milestones: milestonesRes.data || [],
      tasks,
      comments,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch project data" }, { status: 500 });
  }
}

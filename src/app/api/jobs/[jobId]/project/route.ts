import { NextRequest, NextResponse } from "next/server";

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    "apikey": SB_KEY(),
    "Authorization": "Bearer " + SB_KEY(),
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const [milestonesRes, tasksRes, commentsRes] = await Promise.all([
      fetch(SB_URL() + "/rest/v1/project_milestones?job_id=eq." + params.jobId + "&select=*&order=sort_order", {
        headers: sbHeaders(), cache: "no-store",
      }),
      fetch(SB_URL() + "/rest/v1/project_tasks?job_id=eq." + params.jobId + "&select=*&order=created_at.desc", {
        headers: sbHeaders(), cache: "no-store",
      }),
      fetch(SB_URL() + "/rest/v1/project_comments?job_id=eq." + params.jobId + "&select=*&order=created_at.desc", {
        headers: sbHeaders(), cache: "no-store",
      }),
    ]);

    const milestones = await milestonesRes.json();
    const tasks = await tasksRes.json();
    const comments = await commentsRes.json();

    return NextResponse.json({
      milestones: Array.isArray(milestones) ? milestones : [],
      tasks: Array.isArray(tasks) ? tasks : [],
      comments: Array.isArray(comments) ? comments : [],
    });
  } catch {
    return NextResponse.json({ milestones: [], tasks: [], comments: [] }, { status: 500 });
  }
}

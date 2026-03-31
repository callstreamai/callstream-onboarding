import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const { data: task, error } = await supabase
      .from("project_tasks")
      .insert({ job_id: params.jobId, ...body })
      .select()
      .single();
    if (error) throw error;

    // Create notification for assignee
    if (body.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: body.assigned_to,
        type: "task_assigned",
        title: "New task assigned",
        body: task.title,
        link: "/onboarding/" + params.jobId + "/project",
      });
    }

    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { taskId, ...updates } = await req.json();
    if (updates.status === "done" && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("project_tasks").update(updates).eq("id", taskId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { taskId } = await req.json();
    await supabase.from("project_tasks").delete().eq("id", taskId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

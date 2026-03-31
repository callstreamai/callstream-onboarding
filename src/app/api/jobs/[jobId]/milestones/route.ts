import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: any, req: NextRequest) {
  const authHeader = req.headers.get("x-user-id");
  if (!authHeader) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authHeader)
    .single();
  return data?.role === "admin";
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("job_id", params.jobId)
      .order("sort_order");
    if (error) throw error;
    return NextResponse.json({ milestones: data });
  } catch {
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();

    // Admin check
    if (!(await requireAdmin(supabase, req))) {
      return NextResponse.json({ error: "Only admins can manage milestones" }, { status: 403 });
    }

    const body = await req.json();

    // Initializing defaults
    if (body.initDefaults) {
      const defaults = body.milestones || [];
      const rows = defaults.map((m: any) => ({
        job_id: params.jobId,
        name: m.name,
        description: m.description || null,
        sort_order: m.sort_order || 0,
        target_date: m.target_date || null,
      }));
      const { data, error } = await supabase.from("project_milestones").insert(rows).select();
      if (error) throw error;
      return NextResponse.json({ milestones: data });
    }

    // Single milestone create
    const { data, error } = await supabase
      .from("project_milestones")
      .insert({ job_id: params.jobId, ...body })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ milestone: data });
  } catch (err: any) {
    if (err?.status === 403) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();

    if (!(await requireAdmin(supabase, req))) {
      return NextResponse.json({ error: "Only admins can manage milestones" }, { status: 403 });
    }

    const { milestoneId, ...updates } = await req.json();
    if (updates.status === "complete" && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("project_milestones").update(updates).eq("id", milestoneId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();

    if (!(await requireAdmin(supabase, req))) {
      return NextResponse.json({ error: "Only admins can manage milestones" }, { status: 403 });
    }

    const { milestoneId } = await req.json();
    await supabase.from("project_milestones").delete().eq("id", milestoneId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}

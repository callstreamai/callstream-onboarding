import { NextRequest, NextResponse } from "next/server";

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    "apikey": SB_KEY(),
    "Authorization": "Bearer " + SB_KEY(),
    "Content-Type": "application/json",
    "Prefer": "return=representation",
  };
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const userId = req.headers.get("x-user-id");
  if (!userId) return false;
  const res = await fetch(
    SB_URL() + "/rest/v1/profiles?id=eq." + userId + "&select=role&limit=1",
    { headers: sbHeaders(), cache: "no-store" }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 && rows[0].role === "admin";
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const res = await fetch(
      SB_URL() + "/rest/v1/project_milestones?job_id=eq." + params.jobId + "&select=*&order=sort_order",
      { headers: sbHeaders(), cache: "no-store" }
    );
    const milestones = await res.json();
    return NextResponse.json({ milestones: Array.isArray(milestones) ? milestones : [] });
  } catch {
    return NextResponse.json({ milestones: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();

    if (body.initDefaults) {
      const rows = (body.milestones || []).map((m: any) => ({
        job_id: params.jobId,
        name: m.name,
        description: m.description || null,
        sort_order: m.sort_order || 0,
        target_date: m.target_date || null,
        parent_id: null,
      }));
      const res = await fetch(SB_URL() + "/rest/v1/project_milestones", {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify(rows),
      });
      const milestones = await res.json();
      return NextResponse.json({ milestones });
    }

    const res = await fetch(SB_URL() + "/rest/v1/project_milestones", {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        job_id: params.jobId,
        name: body.name,
        description: body.description || null,
        sort_order: body.sort_order || 0,
        target_date: body.target_date || null,
        parent_id: body.parent_id || null,
      }),
    });
    const milestone = await res.json();
    return NextResponse.json({ milestone });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { milestoneId, ...updates } = await req.json();
    if (updates.status === "complete" && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    if (updates.status && updates.status !== "complete") {
      updates.completed_at = null;
    }

    await fetch(SB_URL() + "/rest/v1/project_milestones?id=eq." + milestoneId, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify(updates),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { milestoneId } = await req.json();
    await fetch(SB_URL() + "/rest/v1/project_milestones?id=eq." + milestoneId, {
      method: "DELETE",
      headers: sbHeaders(),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

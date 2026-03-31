import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = createServiceClient();
    const { data: invitation, error } = await supabase
      .from("project_invitations")
      .select("*, onboarding_jobs(property_url)")
      .eq("token", params.token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    return NextResponse.json({ invitation });
  } catch {
    return NextResponse.json({ error: "Failed to verify invitation" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const supabase = createServiceClient();
    const { userId } = await req.json();

    // Find invitation
    const { data: invitation } = await supabase
      .from("project_invitations")
      .select("*")
      .eq("token", params.token)
      .is("accepted_at", null)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    // Mark accepted
    await supabase
      .from("project_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // Add as project member
    await supabase.from("project_members").upsert({
      job_id: invitation.job_id,
      user_id: userId,
      role: "member",
    }, { onConflict: "job_id,user_id" });

    return NextResponse.json({ success: true, jobId: invitation.job_id });
  } catch {
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("project_invitations")
      .select("*")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: false });
    return NextResponse.json({ invitations: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { email, invitedBy, department } = await req.json();

    // Create invitation
    const { data: invitation, error } = await supabase
      .from("project_invitations")
      .insert({
        job_id: params.jobId,
        email,
        invited_by: invitedBy,
      })
      .select()
      .single();
    if (error) throw error;

    // Check if user already exists
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existingUser = usersData?.users?.find(u => u.email === email);

    if (existingUser) {
      // Add as project member
      await supabase.from("project_members").upsert({
        job_id: params.jobId,
        user_id: existingUser.id,
        role: "member",
        department: department || null,
      }, { onConflict: "job_id,user_id" });
    }

    // Generate invite URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const inviteUrl = appUrl + "/invite/" + invitation.token;

    return NextResponse.json({
      invitation,
      inviteUrl,
      userExists: !!existingUser,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

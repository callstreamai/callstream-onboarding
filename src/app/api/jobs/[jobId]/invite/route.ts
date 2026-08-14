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

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@send.callstreamai.com";
    const loginUrl = appUrl + "/login";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: usersData } = await adminClient.auth.admin.listUsers();
    let user = usersData?.users?.find((u) => u.email === email) || null;
    const userExists = Boolean(user);

    if (!user) {
      const tempPassword = crypto.randomUUID().slice(0, 20) + "!Aa1";
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { job_id: params.jobId, department: department || null, role: "client" },
      });

      if (createError) throw createError;
      user = created?.user || null;
    } else if (!user.email_confirmed_at) {
      await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true });
    }

    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    await supabase.from("profiles").upsert(
      { id: user.id, email, role: "client" },
      { onConflict: "id" }
    );

    await supabase.from("project_members").upsert(
      { job_id: params.jobId, user_id: user.id, role: "member", department: department || null },
      { onConflict: "job_id,user_id" }
    );

    let emailSent = false;
    if (resendApiKey) {
      const emailHtml =
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">' +
        '<img src="' + appUrl + '/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />' +
        '<h2 style="color:#111;font-size:20px;margin-bottom:8px;">You\'ve been invited to collaborate</h2>' +
        '<p style="color:#555;font-size:15px;line-height:1.5;">You\'ve been added to a project on the Call Stream AI Onboarding Platform.</p>' +
        '<p style="color:#555;font-size:15px;line-height:1.5;">Use <strong>' + email + '</strong> to request a Magic Code and sign in. No password setup is required.</p>' +
        '<a href="' + loginUrl + '" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Sign in with Magic Code</a>' +
        '<p style="color:#999;font-size:12px;margin-top:32px;">Access is invite-only. If you didn\'t expect this, you can safely ignore this email.</p>' +
        '</div>';

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + resendApiKey },
        body: JSON.stringify({ from: fromEmail, to: [email], subject: "You've been added to a Call Stream AI project", html: emailHtml }),
      });
      emailSent = emailRes.ok;
    }

    const { data: invitation, error: dbError } = await supabase
      .from("project_invitations")
      .insert({ job_id: params.jobId, email, invited_by: invitedBy })
      .select()
      .single();
    if (dbError) throw dbError;

    return NextResponse.json({ invitation, inviteUrl: loginUrl, loginUrl, userExists, emailSent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

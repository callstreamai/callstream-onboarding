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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@send.callstreamai.com";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existingUser = usersData?.users?.find((u) => u.email === email);

    let emailSent = false;
    let inviteUrl = "";

    if (existingUser) {
      // Add as project member
      await supabase.from("project_members").upsert(
        { job_id: params.jobId, user_id: existingUser.id, role: "member", department: department || null },
        { onConflict: "job_id,user_id" }
      );

      // Generate magic link — send via Resend if key available, else Supabase OTP email
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: appUrl + "/onboarding/" + params.jobId + "/workspace" },
      });

      if (!linkError && linkData?.properties?.action_link) {
        inviteUrl = linkData.properties.action_link;

        if (resendApiKey) {
          // Send directly via Resend
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: \`Bearer \${resendApiKey}\` },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "You've been added to a Call Stream AI project",
              html: \`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">
                <img src="\${appUrl}/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />
                <h2 style="color:#111;font-size:20px;margin-bottom:8px;">You've been invited to collaborate</h2>
                <p style="color:#555;font-size:15px;line-height:1.5;">You've been added to a project on the Call Stream AI Onboarding Platform.</p>
                <a href="\${inviteUrl}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Open Project</a>
                <p style="color:#999;font-size:12px;margin-top:32px;">If you didn't expect this, you can safely ignore this email.</p>
              </div>\`,
            }),
          });
          emailSent = emailRes.ok;
        } else {
          // Supabase OTP fallback: send magic link OTP (goes via configured SMTP = Resend)
          const { error: otpError } = await adminClient.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: appUrl + "/onboarding/" + params.jobId + "/workspace" },
          });
          emailSent = !otpError;
        }
      }
    } else {
      // New user: inviteUserByEmail goes via Supabase SMTP (= Resend)
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: appUrl + "/onboarding/" + params.jobId + "/workspace",
        data: { job_id: params.jobId, department: department || null },
      });

      if (!inviteError) {
        emailSent = true;
        inviteUrl = appUrl + "/invite/pending";
      } else {
        // Fallback: generate invite link
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo: appUrl + "/onboarding/" + params.jobId + "/workspace" },
        });
        if (linkData?.properties?.action_link) {
          inviteUrl = linkData.properties.action_link;
          if (resendApiKey) {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: \`Bearer \${resendApiKey}\` },
              body: JSON.stringify({
                from: fromEmail,
                to: [email],
                subject: "You've been invited to Call Stream AI",
                html: \`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">
                  <img src="\${appUrl}/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />
                  <h2 style="color:#111;font-size:20px;margin-bottom:8px;">You've been invited</h2>
                  <p style="color:#555;font-size:15px;line-height:1.5;">Accept your invitation to get started on the Call Stream AI Onboarding Platform.</p>
                  <a href="\${inviteUrl}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Accept Invitation</a>
                  <p style="color:#999;font-size:12px;margin-top:32px;">If you didn't expect this, you can safely ignore this email.</p>
                </div>\`,
              }),
            });
            emailSent = emailRes.ok;
          }
        }
      }
    }

    // Record in project_invitations
    const { data: invitation, error: dbError } = await supabase
      .from("project_invitations")
      .insert({ job_id: params.jobId, email, invited_by: invitedBy })
      .select()
      .single();
    if (dbError) throw dbError;

    return NextResponse.json({ invitation, inviteUrl, userExists: !!existingUser, emailSent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

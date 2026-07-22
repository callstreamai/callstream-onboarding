import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { email, role } = await req.json();

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    if (!["admin", "client"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@send.callstreamai.com";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: existing } = await adminClient.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u) => u.email === email);

    let emailSent = false;
    let inviteLink = "";

    if (existingUser) {
      // Update role in profiles
      const supabase = createServiceClient();
      await supabase.from("profiles").update({ role }).eq("id", existingUser.id);

      // Generate a magic link for them to sign in
      const { data: linkData } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: appUrl + "/" },
      });
      inviteLink = linkData?.properties?.action_link || appUrl + "/login";

      // Send notification via Resend
      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + resendApiKey },
          body: JSON.stringify({
            from: fromEmail,
            to: [email],
            subject: "Your Call Stream AI access has been updated",
            html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">' +
              '<img src="' + appUrl + '/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />' +
              '<h2 style="color:#111;">Your access has been updated</h2>' +
              '<p style="color:#555;">Your role on the Call Stream AI Onboarding Platform has been set to <strong>' + role + '</strong>.</p>' +
              '<a href="' + inviteLink + '" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Sign In</a>' +
              '</div>',
          }),
        });
        emailSent = res.ok;
      }
      return NextResponse.json({ success: true, emailSent, userExists: true, inviteLink });
    }

    // New user: generate invite link via Supabase
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: appUrl + "/auth/handle" },
    });

    if (inviteError) throw inviteError;

    inviteLink = inviteData?.properties?.action_link || "";

    // Send invite email via Resend
    if (resendApiKey && inviteLink) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + resendApiKey },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "You've been invited to Call Stream AI",
          html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">' +
            '<img src="' + appUrl + '/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />' +
            '<h2 style="color:#111;">You\'ve been invited</h2>' +
            '<p style="color:#555;">You\'ve been invited to the Call Stream AI Onboarding Platform. Click below to create your account and get started.</p>' +
            '<a href="' + inviteLink + '" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Complete Registration</a>' +
            '<p style="color:#999;font-size:12px;margin-top:32px;">This link expires in 24 hours. If you didn\'t expect this, you can safely ignore it.</p>' +
            '</div>',
        }),
      });
      emailSent = res.ok;
    } else if (!resendApiKey) {
      // Fallback: use Supabase built-in invite email (goes via Resend SMTP)
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: appUrl + "/auth/handle",
        data: { role },
      });
      emailSent = true;
    }

    return NextResponse.json({ success: true, emailSent, userExists: false, inviteLink });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to invite user" }, { status: 500 });
  }
}

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
    const loginUrl = appUrl + "/login";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const supabase = createServiceClient();

    // Only admins create users. Public login uses shouldCreateUser=false, so
    // unknown emails cannot self-register by requesting a Magic Code.
    const { data: existing } = await adminClient.auth.admin.listUsers();
    let user = existing?.users?.find((u) => u.email === email) || null;
    const userExists = Boolean(user);

    if (!user) {
      const tempPassword = crypto.randomUUID().slice(0, 20) + "!Aa1";
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role },
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
      { id: user.id, email, role },
      { onConflict: "id" }
    );

    let emailSent = false;

    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + resendApiKey },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: userExists
            ? "Your Call Stream AI access has been updated"
            : "You've been invited to Call Stream AI",
          html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#fff;">' +
            '<img src="' + appUrl + '/logo.png" alt="Call Stream AI" style="height:40px;margin-bottom:24px;" />' +
            '<h2 style="color:#111;">' + (userExists ? 'Your access has been updated' : 'You\'ve been invited') + '</h2>' +
            '<p style="color:#555;">Your Call Stream AI Onboarding Platform role is <strong>' + role + '</strong>.</p>' +
            '<p style="color:#555;">Use <strong>' + email + '</strong> to request a Magic Code and sign in. No password setup is required.</p>' +
            '<a href="' + loginUrl + '" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#c026d3;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">Sign in with Magic Code</a>' +
            '<p style="color:#999;font-size:12px;margin-top:32px;">Access is invite-only. If you didn\'t expect this, you can safely ignore it.</p>' +
            '</div>',
        }),
      });
      emailSent = res.ok;
    }

    return NextResponse.json({ success: true, emailSent, userExists, inviteLink: loginUrl, loginUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to invite user" }, { status: 500 });
  }
}

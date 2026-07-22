import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const { email, fullName } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@send.callstreamai.com";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const supabase = createServiceClient();

    // Look up account + job
    const { data: account } = await supabase
      .from("accounts")
      .select("name, onboarding_job_id")
      .eq("id", params.accountId)
      .single();

    const redirectTo = account?.onboarding_job_id
      ? `${appUrl}/onboarding/${account.onboarding_job_id}/workspace`
      : `${appUrl}/`;

    // Check if this email already has a Supabase auth account
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existingUser = usersData?.users?.find((u: any) => u.email === email);

    // Treat as "new" if: no auth account, OR has an account but has NEVER actually signed in
    // (e.g. account was auto-created by "Get Login Link" but user was never sent a registration email)
    const hasEverSignedIn = !!existingUser?.last_sign_in_at;
    let inviteLink = "";
    let isNewUser = !existingUser || !hasEverSignedIn;

    if (isNewUser) {
      // ── New/never-signed-in user: generate a proper invite link (24h, sets up password) ──
      // If they have an auth account but never signed in (e.g. auto-created by Get Login Link),
      // delete it first so we can generate a clean invite link.
      if (existingUser && !hasEverSignedIn) {
        await adminClient.auth.admin.deleteUser(existingUser.id);
      }

      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${appUrl}/auth/complete-signup` },
      });

      if (inviteErr) throw inviteErr;

      const ld = inviteData as any;
      inviteLink =
        ld?.properties?.action_link ||
        ld?.action_link ||
        ld?.user?.action_link ||
        `${appUrl}/login`;

      // Ensure profile + account_user rows exist (user may not have completed signup yet)
      if (inviteData) {
        const userId = (ld?.user?.id || ld?.id) as string | undefined;
        if (userId) {
          await supabase.from("profiles").upsert(
            { id: userId, email, full_name: fullName || "", role: "client" },
            { onConflict: "id" }
          );
          await supabase.from("account_users").upsert(
            { account_id: params.accountId, user_id: userId },
            { onConflict: "account_id,user_id" }
          );
          if (account?.onboarding_job_id) {
            await supabase.from("project_members").upsert(
              { job_id: account.onboarding_job_id, user_id: userId, role: "member" },
              { onConflict: "job_id,user_id" }
            );
          }
        }
      }
    } else {
      // ── Existing user: generate a magic link so they can sign straight in ──
      const { data: magicData, error: magicErr } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

      if (magicErr) throw magicErr;

      const ld = magicData as any;
      inviteLink =
        ld?.properties?.action_link ||
        ld?.action_link ||
        ld?.user?.action_link ||
        `${appUrl}/login`;

      // Make sure they're linked to this account + project
      if (existingUser) {
        await supabase.from("account_users").upsert(
          { account_id: params.accountId, user_id: existingUser.id },
          { onConflict: "account_id,user_id" }
        );
        if (account?.onboarding_job_id) {
          await supabase.from("project_members").upsert(
            { job_id: account.onboarding_job_id, user_id: existingUser.id, role: "member" },
            { onConflict: "job_id,user_id" }
          );
        }
      }
    }

    // ── Send email via Resend ──────────────────────────────────────────────
    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const propertyName = account?.name || "the property";
    const firstName = (fullName || email).split(" ")[0];

    const subject = isNewUser
      ? `You've been invited to Call Stream AI`
      : `Your Call Stream AI access link`;

    const ctaText = isNewUser ? "Complete Registration" : "Sign In";
    const bodyText = isNewUser
      ? `You've been invited to collaborate on <strong>${propertyName}</strong> on the Call Stream AI Onboarding Platform. Click below to create your account — this link expires in <strong>24 hours</strong>.`
      : `You've been given access to <strong>${propertyName}</strong> on the Call Stream AI Onboarding Platform. Click below to sign in.`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#0f0f0f;border-bottom:1px solid #222;padding:28px 36px;">
      <img src="${appUrl}/logo.png" alt="Call Stream AI" style="height:36px;width:auto;" />
    </div>

    <!-- Body -->
    <div style="padding:36px;">
      <h2 style="margin:0 0 12px;color:#fff;font-size:20px;font-weight:600;">
        Hi ${firstName},
      </h2>
      <p style="margin:0 0 24px;color:#aaa;font-size:15px;line-height:1.6;">
        ${bodyText}
      </p>

      <!-- CTA button -->
      <a href="${inviteLink}"
         style="display:inline-block;padding:13px 32px;background:#c026d3;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
        ${ctaText} →
      </a>

      ${isNewUser ? `
      <p style="margin:28px 0 0;color:#666;font-size:12px;line-height:1.5;">
        This link expires in 24 hours. If you didn't expect this invitation, you can safely ignore it.
      </p>` : `
      <p style="margin:28px 0 0;color:#666;font-size:12px;line-height:1.5;">
        This is a one-time sign-in link. If you didn't expect this, you can safely ignore it.
      </p>`}
    </div>

    <!-- Footer -->
    <div style="background:#0f0f0f;border-top:1px solid #222;padding:20px 36px;">
      <p style="margin:0;color:#555;font-size:11px;">
        Call Stream AI · launch.callstreamai.com
      </p>
    </div>

  </div>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: [email], subject, html }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}));
      throw new Error(`Resend error: ${JSON.stringify(errBody)}`);
    }

    const emailData = await emailRes.json();

    return NextResponse.json({
      success: true,
      emailId: emailData.id,
      isNewUser,
      inviteLink,
      message: isNewUser
        ? `Invite email sent to ${email} — link expires in 24 hours`
        : `Sign-in email sent to ${email}`,
    });

  } catch (err: any) {
    console.error("send-invite error:", err);
    return NextResponse.json({ error: err.message || "Failed to send invite" }, { status: 500 });
  }
}

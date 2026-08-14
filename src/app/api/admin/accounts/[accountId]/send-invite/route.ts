import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureContactPortalUser } from "@/lib/provisionContactUser";

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
    const supabase = createServiceClient();

    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", params.accountId)
      .single();

    const provisioned = await ensureContactPortalUser({
      accountId: params.accountId,
      email,
      fullName,
    });

    const inviteLink = `${appUrl}/login`;
    const redirectTo = provisioned.linkedJobs[0]
      ? `${appUrl}/onboarding/${provisioned.linkedJobs[0]}/workspace`
      : inviteLink;

    if (!resendApiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const propertyName = account?.name || "the property";
    const firstName = (fullName || email).split(" ")[0];

    const subject = `You've been invited to Call Stream AI`;
    const ctaText = "Sign in with Magic Code";
    const bodyText = `You've been invited to collaborate on <strong>${propertyName}</strong> on the Call Stream AI Onboarding Platform. Use the email address <strong>${email}</strong> to request a Magic Code and sign in. No password setup is required.`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
    <div style="background:#0f0f0f;border-bottom:1px solid #222;padding:28px 36px;">
      <img src="${appUrl}/logo.png" alt="Call Stream AI" style="height:36px;width:auto;" />
    </div>
    <div style="padding:36px;">
      <h2 style="margin:0 0 12px;color:#fff;font-size:20px;font-weight:600;">Hi ${firstName},</h2>
      <p style="margin:0 0 24px;color:#aaa;font-size:15px;line-height:1.6;">${bodyText}</p>
      <a href="${inviteLink}" style="display:inline-block;padding:13px 32px;background:#c026d3;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.01em;">${ctaText} →</a>
      <p style="margin:28px 0 0;color:#666;font-size:12px;line-height:1.5;">If you didn't expect this invitation, you can safely ignore it.</p>
    </div>
    <div style="background:#0f0f0f;border-top:1px solid #222;padding:20px 36px;">
      <p style="margin:0;color:#555;font-size:11px;">Call Stream AI · launch.callstreamai.com</p>
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
      userId: provisioned.user?.id,
      inviteLink,
      loginUrl: inviteLink,
      onboardingUrl: redirectTo,
      linkedJobs: provisioned.linkedJobs,
      message: `Invite email sent to ${email} — user can sign in with a Magic Code`,
    });
  } catch (err: any) {
    console.error("send-invite error:", err);
    return NextResponse.json({ error: err.message || "Failed to send invite" }, { status: 500 });
  }
}

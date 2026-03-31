import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const { email, fullName } = await req.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://launch.callstreamai.com";

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const supabase = createServiceClient();

    // Check if user already exists
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    let existingUser = usersData?.users?.find((u: any) => u.email === email);

    if (!existingUser) {
      const tempPassword = crypto.randomUUID().slice(0, 20) + "!Aa1";
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      });

      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 400 });
      }
      existingUser = newUser?.user || null;
    } else {
      if (!existingUser.email_confirmed_at) {
        await adminClient.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
        });
      }
    }

    if (!existingUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Ensure profile exists
    await supabase.from("profiles").upsert({
      id: existingUser.id,
      email,
      full_name: fullName || "",
      role: "client",
    }, { onConflict: "id" });

    // Link user to account
    await supabase.from("account_users").upsert({
      account_id: params.accountId,
      user_id: existingUser.id,
    }, { onConflict: "account_id,user_id" });

    // Get the account
    const { data: account } = await supabase
      .from("accounts")
      .select("onboarding_job_id, name")
      .eq("id", params.accountId)
      .single();

    // Add as project member if job exists
    if (account?.onboarding_job_id) {
      await supabase.from("project_members").upsert({
        job_id: account.onboarding_job_id,
        user_id: existingUser.id,
        role: "member",
      }, { onConflict: "job_id,user_id" }).then(() => {});
    }

    // Generate magic link via Supabase Admin API
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: appUrl + "/auth/callback",
      },
    });

    if (linkErr || !linkData) {
      return NextResponse.json({ error: linkErr?.message || "Failed to generate link" }, { status: 500 });
    }

    // Extract action_link — handle all possible response shapes from Supabase JS client
    const ld = linkData as any;
    const actionLink =
      ld?.properties?.action_link ||
      ld?.action_link ||
      ld?.user?.action_link ||
      "";

    // If we still can't find it, build it manually from the hashed_token
    let magicLink = actionLink;
    if (!magicLink) {
      const hashedToken =
        ld?.properties?.hashed_token ||
        ld?.hashed_token ||
        ld?.user?.hashed_token ||
        "";
      if (hashedToken) {
        magicLink = process.env.NEXT_PUBLIC_SUPABASE_URL +
          "/auth/v1/verify?token=" + hashedToken +
          "&type=magiclink" +
          "&redirect_to=" + encodeURIComponent(appUrl + "/auth/callback");
      }
    }

    // Final fallback: just provide the login URL
    if (!magicLink) {
      magicLink = appUrl + "/login";
    }

    // Build onboarding URL
    let onboardingUrl = appUrl;
    if (account?.onboarding_job_id) {
      onboardingUrl = appUrl + "/onboarding/" + account.onboarding_job_id + "/workspace";
    }

    return NextResponse.json({
      success: true,
      userId: existingUser.id,
      magicLink,
      onboardingUrl,
      loginUrl: appUrl + "/login",
      propertyName: account?.name || "",
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

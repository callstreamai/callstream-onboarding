import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = createServiceClient();
    const userId = new URL(req.url).searchParams.get("userId") || "";
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    let authUser: any = null;
    try {
      const { data } = await adminClient.auth.admin.getUserById(userId);
      authUser = data?.user || null;
    } catch {}

    const email = String(profile?.email || authUser?.email || "").trim().toLowerCase();

    const { data: accountUsers } = await supabase
      .from("account_users")
      .select("*")
      .eq("user_id", userId);

    const { data: projectMembers } = await supabase
      .from("project_members")
      .select("*")
      .eq("user_id", userId);

    const accountIds = (accountUsers || []).map((row: any) => row.account_id).filter(Boolean);
    const jobIds = (projectMembers || []).map((row: any) => row.job_id).filter(Boolean);

    const { data: accounts } = accountIds.length
      ? await supabase.from("accounts").select("*").in("id", accountIds)
      : { data: [] as any[] };

    const { data: jobs } = jobIds.length
      ? await supabase.from("onboarding_jobs").select("id, account_id, property_name, property_url, status, extraction_status").in("id", jobIds)
      : { data: [] as any[] };

    const { data: contacts } = email
      ? await supabase.from("contacts").select("*").ilike("email", email)
      : { data: [] as any[] };

    const records = [
      { label: "Auth user", status: authUser ? "Exists" : "Missing" },
      { label: "Email confirmed", status: authUser?.email_confirmed_at ? "Yes" : "No" },
      { label: "Deleted/banned", status: authUser?.deleted_at || authUser?.banned_until ? "Yes" : "No" },
      { label: "Profile", status: profile ? "Exists" : "Missing" },
      { label: "Role", status: profile?.role || "—" },
      { label: "Contact record", status: (contacts || []).length > 0 ? "Exists" : "Missing" },
      { label: "Account links", status: String((accountUsers || []).length) },
      { label: "Project memberships", status: String((projectMembers || []).length) },
    ];

    return NextResponse.json({
      user: {
        id: userId,
        email,
        full_name: profile?.full_name || authUser?.user_metadata?.full_name || null,
        role: profile?.role || null,
      },
      auth: authUser ? {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        banned_until: authUser.banned_until,
        deleted_at: authUser.deleted_at,
      } : null,
      profile,
      contacts: contacts || [],
      account_users: accountUsers || [],
      project_members: projectMembers || [],
      accounts: accounts || [],
      projects: jobs || [],
      records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch user detail" }, { status: 500 });
  }
}

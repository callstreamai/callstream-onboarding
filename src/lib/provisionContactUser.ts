import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

function normalizeEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureContactPortalUser({
  accountId,
  email,
  fullName,
  role = "client",
}: {
  accountId: string;
  email?: string | null;
  fullName?: string | null;
  role?: "client" | "admin";
}) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return { user: null, linkedJobs: [] as string[] };

  const supabase = createServiceClient();
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) throw listError;

  let user = usersData?.users?.find((u: any) => normalizeEmail(u.email) === cleanEmail) || null;

  if (!user) {
    const tempPassword = crypto.randomUUID().slice(0, 20) + "!Aa1";
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName || "", role },
    });
    if (createError) throw createError;
    user = created?.user || null;
  } else if (!user.email_confirmed_at) {
    await adminClient.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  if (!user) throw new Error("Failed to create or find user");

  await supabase.from("profiles").upsert(
    { id: user.id, email: cleanEmail, full_name: fullName || "", role },
    { onConflict: "id" }
  );

  await supabase.from("account_users").upsert(
    { account_id: accountId, user_id: user.id },
    { onConflict: "account_id,user_id" }
  );

  const { data: jobs, error: jobsError } = await supabase
    .from("onboarding_jobs")
    .select("id")
    .eq("account_id", accountId);
  if (jobsError) throw jobsError;

  const linkedJobs: string[] = [];
  for (const job of jobs || []) {
    await supabase.from("project_members").upsert(
      { job_id: job.id, user_id: user.id, role: "member" },
      { onConflict: "job_id,user_id" }
    );
    linkedJobs.push(job.id);
  }

  return { user, linkedJobs };
}

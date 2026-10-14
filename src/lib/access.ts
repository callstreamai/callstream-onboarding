import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { createServiceClient } from "@/lib/supabase/server";

export class AccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function requireUser() {
  const {
    data: { user },
    error,
  } = await createServerSupabaseClient().auth.getUser();
  if (error || !user) throw new AccessError("Please sign in to continue.", 401);
  const db = createServiceClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile)
    throw new AccessError("Your account could not be verified.", 403);
  return { user, db, isAdmin: profile.role === "admin" };
}
export async function requireAdmin() {
  const access = await requireUser();
  if (!access.isAdmin)
    throw new AccessError(
      "This action is available to your Call Stream team only.",
      403,
    );
  return access;
}
export async function requireProject(jobId: string, adminOnly = false) {
  const access = await requireUser();
  if (adminOnly && !access.isAdmin)
    throw new AccessError(
      "This action is available to your Call Stream team only.",
      403,
    );
  const { data: job, error } = await access.db
    .from("onboarding_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !job) throw new AccessError("Project not found.", 404);
  if (!access.isAdmin && job.created_by !== access.user.id) {
    const { data: member } = await access.db
      .from("project_members")
      .select("job_id")
      .eq("job_id", jobId)
      .eq("user_id", access.user.id)
      .maybeSingle();
    if (!member) throw new AccessError("Project not found.", 404);
  }
  return { ...access, job };
}
export function accessResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AccessError
          ? error.message
          : "We could not complete this request. Please try again.",
    },
    { status: error instanceof AccessError ? error.status : 500 },
  );
}
export async function guardProject(jobId: string, adminOnly = false) {
  try {
    await requireProject(jobId, adminOnly);
    return null;
  } catch (error) {
    return accessResponse(error);
  }
}

export async function guardAdmin() {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    return accessResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch (_e) {}
          },
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createServiceClient();

    let isAdmin = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
    }

    const statusFilter = req.nextUrl.searchParams.get("status");
    const showAll = req.nextUrl.searchParams.get("all") === "true";

    let query = supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (showAll && isAdmin) {
      // Admin viewing all — no filter
    } else if (user) {
      // Get job_ids where this user is a project member (invited)
      const { data: memberships } = await supabase
        .from("project_members")
        .select("job_id")
        .eq("user_id", user.id);

      const memberJobIds = (memberships ?? []).map((m: any) => m.job_id).filter(Boolean);

      if (memberJobIds.length > 0) {
        // Show jobs they created OR were invited to
        query = query.or(`created_by.eq.${user.id},id.in.(${memberJobIds.join(",")})`);
      } else {
        // No memberships — just their own
        query = query.eq("created_by", user.id);
      }
    }

    if (statusFilter) {
      const statuses = statusFilter.split(",");
      query = query.in("status", statuses);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ jobs: jobs || [] });
  } catch (_err) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

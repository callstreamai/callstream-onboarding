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
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
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

    // "My Submissions" always filters by user. 
    // "All Submissions" (admin + ?all=true) shows everything.
    if (showAll && isAdmin) {
      // Admin viewing all — no filter
    } else if (user) {
      // Everyone else (including admins on "My Submissions") sees only their own
      query = query.eq("created_by", user.id);
    }

    if (statusFilter) {
      const statuses = statusFilter.split(",");
      query = query.in("status", statuses);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

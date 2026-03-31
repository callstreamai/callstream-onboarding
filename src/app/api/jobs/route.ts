import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    // Get current user
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

    // Check if admin
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

    let query = supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    // Clients only see their own jobs
    if (!isAdmin && user) {
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

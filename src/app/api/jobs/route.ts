import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const statusFilter = req.nextUrl.searchParams.get("status");

    let query = supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

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

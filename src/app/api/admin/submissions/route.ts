import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Service role bypasses RLS - returns all jobs
    const { data: jobs, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

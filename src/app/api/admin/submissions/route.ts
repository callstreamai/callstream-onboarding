import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    // Create a fresh client with explicit service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: jobs, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin submissions error:", error);
      return NextResponse.json({ error: error.message, jobs: [] }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err: any) {
    console.error("Admin submissions catch:", err);
    return NextResponse.json({ error: err.message, jobs: [] }, { status: 500 });
  }
}

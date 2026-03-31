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
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Get jobs scoped to user
    let jobsQuery = supabase.from("onboarding_jobs").select("*");
    if (!isAdmin) {
      jobsQuery = jobsQuery.eq("created_by", user.id);
    }
    const { data: jobs } = await jobsQuery;
    const allJobs = jobs || [];

    const totalProperties = allJobs.length;
    const active = allJobs.filter(j => !["approved", "rejected", "extraction_complete"].includes(j.status)).length;
    const pendingReview = allJobs.filter(j => j.status === "extraction_complete" || j.status === "review_pending" || j.status === "review_in_progress").length;
    const completed = allJobs.filter(j => j.status === "approved").length;

    const pagesCrawled = allJobs.reduce((sum, j) => sum + (j.pages_crawled || 0), 0);
    const filesProcessed = allJobs.reduce((sum, j) => sum + (j.files_processed || 0), 0);

    // Count extracted fields
    const jobIds = allJobs.map(j => j.id);
    let fieldsExtracted = 0;
    let avgConfidence = 0;

    if (jobIds.length > 0) {
      const { count } = await supabase
        .from("extraction_fields")
        .select("*", { count: "exact", head: true })
        .in("job_id", jobIds);
      fieldsExtracted = count || 0;

      // Avg confidence from jobs
      const confs = allJobs.filter(j => j.extraction_confidence).map(j => j.extraction_confidence);
      if (confs.length > 0) {
        avgConfidence = confs.reduce((a, b) => a + b, 0) / confs.length;
      }
    }

    // Recent uploads (files visible to client)
    let uploadsQuery = supabase
      .from("uploaded_files")
      .select("id, job_id, file_name, file_type, file_size, processing_status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!isAdmin && jobIds.length > 0) {
      uploadsQuery = uploadsQuery.in("job_id", jobIds);
    }
    const { data: recentFiles } = await uploadsQuery;

    return NextResponse.json({
      totalProperties,
      active,
      pendingReview,
      completed,
      pagesCrawled,
      filesProcessed,
      fieldsExtracted,
      avgConfidence: Math.round(avgConfidence * 100),
      recentFiles: recentFiles || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
    let jobsQuery = supabase.from("onboarding_jobs").select("*").order("created_at", { ascending: false });
    if (!isAdmin) {
      jobsQuery = jobsQuery.eq("created_by", user.id);
    }
    const { data: jobs } = await jobsQuery;
    const allJobs = jobs || [];

    const totalProperties = allJobs.length;
    const active = allJobs.filter(j => ["consent_given", "upload_complete", "crawling", "crawl_complete", "extracting"].includes(j.status)).length;
    const pendingReview = allJobs.filter(j => ["extraction_complete", "review_pending", "review_in_progress"].includes(j.status)).length;
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

      const confs = allJobs.filter(j => j.extraction_confidence).map(j => j.extraction_confidence);
      if (confs.length > 0) {
        avgConfidence = confs.reduce((a: number, b: number) => a + b, 0) / confs.length;
      }
    }

    // Recent uploads
    let uploadsQuery = supabase
      .from("uploaded_files")
      .select("id, job_id, file_name, file_type, file_size, processing_status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!isAdmin && jobIds.length > 0) {
      uploadsQuery = uploadsQuery.in("job_id", jobIds);
    } else if (!isAdmin) {
      uploadsQuery = uploadsQuery.eq("job_id", "00000000-0000-0000-0000-000000000000"); // no results
    }
    const { data: recentFiles } = await uploadsQuery;

    // Workspaces (jobs that have been crawled/extracted)
    const workspaces = allJobs.map(j => ({
      id: j.id,
      property_url: j.property_url,
      property_name: j.property_name || null,
      status: j.status,
      pages_crawled: j.pages_crawled || 0,
      files_processed: j.files_processed || 0,
      created_at: j.created_at,
    }));

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
      workspaces,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

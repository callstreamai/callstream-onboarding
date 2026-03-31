import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { crawlProperty } from "@/lib/crawl/link-follower";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { jobId, propertyUrl } = await req.json();

    // Guard: Check if this job was already crawled
    const { data: existingJob } = await supabase
      .from("onboarding_jobs")
      .select("status, pages_crawled")
      .eq("id", jobId)
      .single();

    if (existingJob && (
      existingJob.status === "crawl_complete" ||
      existingJob.status === "extracting" ||
      existingJob.status === "extraction_complete" ||
      existingJob.status === "review_pending" ||
      existingJob.status === "approved"
    )) {
      // Already crawled — return existing data
      return NextResponse.json({
        pagesCrawled: existingJob.pages_crawled || 0,
        pagesFailed: 0,
        totalPages: existingJob.pages_crawled || 0,
        skipped: true,
        message: "Already crawled",
      });
    }

    // Update job status
    await supabase
      .from("onboarding_jobs")
      .update({ status: "crawling" })
      .eq("id", jobId);

    // Crawl the property (single crawl, max 30 pages)
    const results = await crawlProperty(propertyUrl, {
      maxPages: 30,
    });

    // Store crawled pages
    const pages = results.map((r) => ({
      job_id: jobId,
      url: r.url,
      title: r.title || null,
      content_text: r.text || null,
      page_type: r.pageType,
      status: r.error ? "failed" : "fetched",
      fetch_method: r.method,
      error_message: r.error,
    }));

    if (pages.length > 0) {
      await supabase.from("crawled_pages").insert(pages);
    }

    const crawled = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    // Update job stats
    await supabase
      .from("onboarding_jobs")
      .update({
        status: "crawl_complete",
        pages_found: results.length,
        pages_crawled: crawled,
        pages_failed: failed,
      })
      .eq("id", jobId);

    return NextResponse.json({
      pagesCrawled: crawled,
      pagesFailed: failed,
      totalPages: results.length,
    });
  } catch (err) {
    console.error("Crawl error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Crawl failed" },
      { status: 500 }
    );
  }
}

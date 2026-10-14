import { NextRequest, NextResponse } from "next/server";
import { requireProject, accessResponse, AccessError } from "@/lib/access";
import { crawlProperty } from "@/lib/crawl/link-follower";
import { claim, finish } from "@/lib/property-operations";

export async function POST(req: NextRequest) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { jobId, rescrape, requestId } = await req.json();
    const { db, job } = await requireProject(jobId, true);
    if (
      rescrape &&
      (typeof requestId !== "string" ||
        !requestId.trim() ||
        requestId.length > 100)
    )
      throw new AccessError("A rescrape request identifier is required.", 400);
    const key = rescrape
      ? `${job.property_url}:${requestId}`
      : job.property_url;
    const op = await claim(db, jobId, "crawl", key);
    if (op.cached) return NextResponse.json({ ...op.result, skipped: true });
    release = async () => {
      await finish(db, jobId, op.token, key, {}, false);
    };
    const { count, error: countError } = await db
      .from("crawled_pages")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "fetched");
    if (countError) throw countError;
    if (count && !rescrape) {
      await finish(db, jobId, op.token, key, { pagesCrawled: count });
      release = undefined;
      return NextResponse.json({ pagesCrawled: count, skipped: true });
    }
    const results = await crawlProperty(job.property_url, { maxPages: 30 });
    const successful = results.filter(
      (r) => !r.error && r.text.trim().length > 50,
    );
    if (!successful.length)
      throw new AccessError(
        "No readable website content was found. Add documents to the workspace or try the website again.",
        422,
      );
    const pages = results.map((r) => ({
      url: r.url,
      title: r.title,
      content_text: r.text,
      page_type: r.pageType,
      status: r.error ? "failed" : "fetched",
      fetch_method: r.method,
      error_message: r.error,
    }));
    const { error } = await db.rpc("commit_property_crawl", {
      p_job: jobId,
      p_token: op.token,
      p_pages: pages,
      p_key: key,
    });
    if (error) throw error;
    release = undefined;
    return NextResponse.json({ pagesCrawled: successful.length });
  } catch (error) {
    if (release) await release().catch(() => {});
    return accessResponse(error);
  }
}

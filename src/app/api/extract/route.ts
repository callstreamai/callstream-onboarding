import { NextRequest, NextResponse } from "next/server";
import { requireProject, accessResponse, AccessError } from "@/lib/access";
import {
  extractPropertyData,
  type ExtractionSource,
} from "@/lib/extract/llm-extractor";
import { claim, finish, fingerprint } from "@/lib/property-operations";

export async function POST(req: NextRequest) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { jobId } = await req.json();
    const { db } = await requireProject(jobId, true);
    const { data: pages, error } = await db
      .from("crawled_pages")
      .select("id,url,title,content_text")
      .eq("job_id", jobId)
      .eq("status", "fetched")
      .order("url");
    if (error) throw error;
    const sources: ExtractionSource[] = (pages || [])
      .filter((p) => p.content_text)
      .map((p) => ({
        type: "web",
        id: p.id,
        name: p.title || p.url,
        content: p.content_text,
      }));
    if (!sources.length)
      throw new AccessError(
        "Scrape the website before extracting its content.",
        422,
      );
    const key = fingerprint(sources);
    const op = await claim(db, jobId, "extract", key);
    if (op.cached) return NextResponse.json({ ...op.result, skipped: true });
    release = () => finish(db, jobId, op.token, key, {}, false);
    const result = await extractPropertyData(sources);
    const fields = Object.entries(result.data).map(
      ([field_name, extracted_value]) => ({
        field_name,
        extracted_value,
        confidence: result.confidence[field_name] || 0,
        source_snippets: (result.sourceMapping[field_name] || []).map((id) => {
          const s = sources.find((x) => x.id === id);
          return {
            text: s?.content.slice(0, 200) || "",
            source_type: "web",
            source_id: id,
            source_name: s?.name || "",
          };
        }),
      }),
    );
    const response = {
      confidence: result.overallConfidence,
      fieldsExtracted: fields.length,
    };
    const { error: saveError } = await db.rpc("commit_property_extraction", {
      p_job: jobId,
      p_token: op.token,
      p_key: key,
      p_data: {
        ...result.data,
        source_urls: (pages || []).map((p) => p.url),
        source_files: [],
        confidence_score: result.overallConfidence,
      },
      p_fields: fields,
      p_result: response,
    });
    if (saveError) throw saveError;
    release = undefined;
    return NextResponse.json(response);
  } catch (error) {
    if (release) await release().catch(() => {});
    return accessResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractPropertyData, type ExtractionSource } from "@/lib/extract/llm-extractor";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { jobId, rerun } = await req.json();

    // Update status
    await supabase
      .from("onboarding_jobs")
      .update({
        status: "extracting",
        extraction_status: "running",
      })
      .eq("id", jobId);

    // If re-running, clear old extraction data
    if (rerun) {
      await supabase.from("extraction_fields").delete().eq("job_id", jobId);
      await supabase.from("property_data").delete().eq("job_id", jobId);
    }

    // Gather sources: crawled pages
    const { data: pages } = await supabase
      .from("crawled_pages")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "fetched")
      .order("created_at");

    // Gather sources: uploaded files
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("job_id", jobId)
      .eq("processing_status", "complete");

    const sources: ExtractionSource[] = [];

    // Add web pages (prioritize important page types)
    const priorityOrder = [
      "homepage", "amenities", "pricing", "units", "policies",
      "contact", "faq", "neighborhood", "specials", "about",
    ];

    const sortedPages = [...(pages || [])].sort((a, b) => {
      const aIdx = priorityOrder.indexOf(a.page_type || "");
      const bIdx = priorityOrder.indexOf(b.page_type || "");
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    for (const page of sortedPages.slice(0, 15)) {
      if (page.content_text) {
        sources.push({
          type: "web",
          id: page.id,
          name: page.title || page.url,
          content: page.content_text,
        });
      }
    }

    // Add file content
    for (const file of files || []) {
      if (file.extracted_text) {
        sources.push({
          type: "file",
          id: file.id,
          name: file.file_name,
          content: file.extracted_text,
        });
      }
    }

    if (sources.length === 0) {
      throw new Error("No source content available for extraction");
    }

    // Run LLM extraction
    const result = await extractPropertyData(sources);

    // Store property data
    const { data: propData } = await supabase
      .from("property_data")
      .insert({
        job_id: jobId,
        ...result.data,
        source_urls: (pages || []).map((p) => p.url),
        source_files: (files || []).map((f) => f.file_name),
        confidence_score: result.overallConfidence,
      })
      .select()
      .single();

    // Create extraction fields for review
    const extractionFields = Object.entries(result.data).map(([key, value]) => ({
      job_id: jobId,
      property_data_id: propData?.id,
      field_name: key,
      extracted_value: typeof value === "object" ? value : JSON.stringify(value),
      confidence: result.confidence[key] || 0,
      source_snippets: (result.sourceMapping[key] || []).map((sourceId) => {
        const source = sources.find((s) => s.id === sourceId);
        return {
          text: source?.content.slice(0, 200) || "",
          source_type: source?.type || "web",
          source_id: sourceId,
          source_name: source?.name || "Unknown",
        };
      }),
      status: "pending",
    }));

    if (extractionFields.length > 0) {
      await supabase.from("extraction_fields").insert(extractionFields);
    }

    // Update job
    await supabase
      .from("onboarding_jobs")
      .update({
        status: "extraction_complete",
        extraction_status: "complete",
        extraction_confidence: result.overallConfidence,
        fields_total: extractionFields.length,
        fields_reviewed: 0,
        fields_accepted: 0,
        fields_edited: 0,
        fields_rejected: 0,
      })
      .eq("id", jobId);

    return NextResponse.json({
      confidence: result.overallConfidence,
      fieldsExtracted: extractionFields.length,
    });
  } catch (err) {
    console.error("Extraction error:", err);

    // Update job with error
    const supabase = createServiceClient();
    const { jobId } = await req.json().catch(() => ({ jobId: null }));
    if (jobId) {
      await supabase
        .from("onboarding_jobs")
        .update({ status: "error", extraction_status: "failed" })
        .eq("id", jobId);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

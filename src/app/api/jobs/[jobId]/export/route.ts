import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;

    // Get job
    const { data: job } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get property data
    const { data: propertyData } = await supabase
      .from("property_data")
      .select("*")
      .eq("job_id", jobId)
      .single();

    // Get extraction fields with review status
    const { data: fields } = await supabase
      .from("extraction_fields")
      .select("*")
      .eq("job_id", jobId)
      .order("field_name");

    // Get crawled pages
    const { data: pages } = await supabase
      .from("crawled_pages")
      .select("url, title, page_type, status")
      .eq("job_id", jobId)
      .eq("status", "fetched");

    // Get uploaded files
    const { data: files } = await supabase
      .from("uploaded_files")
      .select("file_name, file_type, file_size, processing_status")
      .eq("job_id", jobId);

    // Build the final reviewed data (use edited values where available)
    const reviewedData: Record<string, unknown> = {};
    for (const field of fields || []) {
      if (field.status === "rejected") continue;
      reviewedData[field.field_name] =
        field.status === "edited" && field.edited_value !== null
          ? field.edited_value
          : field.extracted_value;
    }

    // Build export
    const exportData = {
      _meta: {
        exported_at: new Date().toISOString(),
        platform: "Call Stream AI Onboarding",
        version: "1.0.0",
        job_id: jobId,
        property_url: job.property_url,
        vertical: job.vertical,
        status: job.status,
        confidence: job.extraction_confidence,
      },
      property: {
        ...propertyData,
        ...reviewedData,
      },
      review_summary: {
        total_fields: fields?.length || 0,
        accepted: fields?.filter((f) => f.status === "accepted").length || 0,
        edited: fields?.filter((f) => f.status === "edited").length || 0,
        rejected: fields?.filter((f) => f.status === "rejected").length || 0,
        pending: fields?.filter((f) => f.status === "pending").length || 0,
      },
      sources: {
        web_pages: pages || [],
        uploaded_files: files || [],
      },
      fields: (fields || []).map((f) => ({
        name: f.field_name,
        value: f.status === "edited" ? f.edited_value : f.extracted_value,
        confidence: f.confidence,
        status: f.status,
        source_count: f.source_snippets?.length || 0,
      })),
    };

    // Return as downloadable JSON
    const fileName = `callstream-onboarding-${job.property_url
      .replace(/https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .slice(0, 50)}-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}

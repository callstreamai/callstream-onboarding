import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const PROPERTY_FIELDS = [
  "property_name",
  "vertical",
  "address",
  "city",
  "state",
  "zip_code",
  "phone",
  "email",
  "website",
  "management_company",
  "unit_types",
  "pricing_ranges",
  "specials_promotions",
  "amenities",
  "pet_policy",
  "parking",
  "fees_deposits",
  "lease_terms",
  "office_hours",
  "application_requirements",
  "neighborhood_highlights",
  "channels",
  "source_urls",
  "source_files",
  "confidence_score",
  "created_at",
  "updated_at",
];

function titleize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function cleanPropertyData(row: any) {
  if (!row) return null;
  const out: Record<string, any> = {};
  for (const key of PROPERTY_FIELDS) out[key] = row[key];
  return out;
}

function extractionToMarkdown(payload: any) {
  const job = payload.job || {};
  const data = payload.property_data || {};
  const fields = payload.fields || [];
  const pages = payload.sources?.web_pages || [];
  const files = payload.sources?.files || [];

  const lines: string[] = [];
  lines.push(`# ${data.property_name || job.property_name || job.property_url || "Extraction"}`);
  lines.push("");
  if (job.property_url) lines.push(`**Website:** ${job.property_url}`);
  if (job.status) lines.push(`**Status:** ${String(job.status).replace(/_/g, " ")}`);
  if (payload.meta?.has_extraction_rows === false) {
    lines.push("**Extraction Data:** No structured extraction rows are currently stored for this job.");
  }
  if (data.confidence_score !== undefined && data.confidence_score !== null) {
    lines.push(`**Confidence:** ${Math.round(Number(data.confidence_score) * 100)}%`);
  } else if (job.extraction_confidence !== undefined && job.extraction_confidence !== null) {
    lines.push(`**Job Confidence Flag:** ${Math.round(Number(job.extraction_confidence) * 100)}%`);
  }
  lines.push(`**Exported:** ${new Date().toISOString()}`);
  lines.push("");

  if (!payload.meta?.has_extraction_rows) {
    lines.push("## Source Manifest");
    lines.push("");
    lines.push("This job is marked extraction complete, but no structured `property_data` or `extraction_fields` rows are currently stored. The source inventory below is available for re-extraction or review.");
    lines.push("");
  }

  if (payload.meta?.has_extraction_rows) {
    lines.push("## Extracted Property Data");
    lines.push("");
    for (const key of PROPERTY_FIELDS) {
      if (["source_urls", "source_files", "created_at", "updated_at"].includes(key)) continue;
      lines.push(`### ${titleize(key)}`);
      const value = data[key];
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push("—");
        } else {
          for (const item of value) lines.push(`- ${typeof item === "object" ? JSON.stringify(item) : String(item)}`);
        }
      } else if (typeof value === "object" && value) {
        lines.push("```json");
        lines.push(JSON.stringify(value, null, 2));
        lines.push("```");
      } else {
        lines.push(formatValue(value));
      }
      lines.push("");
    }
  }

  if (fields.length > 0) {
    lines.push("## Field Review Detail");
    lines.push("");
    for (const field of fields) {
      lines.push(`### ${titleize(field.field_name)}`);
      lines.push(`- **Status:** ${field.status || "pending"}`);
      if (field.confidence !== undefined && field.confidence !== null) {
        lines.push(`- **Confidence:** ${Math.round(Number(field.confidence) * 100)}%`);
      }
      lines.push("- **Extracted Value:**");
      lines.push("```json");
      lines.push(JSON.stringify(field.edited_value ?? field.extracted_value ?? null, null, 2));
      lines.push("```");
      const snippets = Array.isArray(field.source_snippets) ? field.source_snippets : [];
      if (snippets.length > 0) {
        lines.push("- **Sources:**");
        for (const snippet of snippets.slice(0, 5)) {
          lines.push(`  - ${snippet.source_name || snippet.source_id || "Source"}: ${String(snippet.text || "").replace(/\s+/g, " ").slice(0, 220)}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("## Sources");
  lines.push("");
  if (pages.length > 0) {
    lines.push("### Web Pages");
    for (const page of pages) lines.push(`- ${page.title || page.url} — ${page.url}`);
    lines.push("");
  }
  if (files.length > 0) {
    lines.push("### Uploaded Files");
    for (const file of files) lines.push(`- ${file.file_name} (${file.file_type || "file"})`);
    lines.push("");
  }

  return lines.join("\n");
}

function safeFileName(name: string) {
  return (name || "extraction").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "extraction";
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const format = req.nextUrl.searchParams.get("format") || "json";
    const download = req.nextUrl.searchParams.get("download") === "true";
    const supabase = createServiceClient();

    const [jobRes, propertyRes, fieldsRes, pagesRes, filesRes] = await Promise.all([
      supabase.from("onboarding_jobs").select("*").eq("id", params.jobId).single(),
      supabase.from("property_data").select("*").eq("job_id", params.jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("extraction_fields").select("*").eq("job_id", params.jobId).order("field_name"),
      supabase.from("crawled_pages").select("id, url, title, page_type, status, created_at").eq("job_id", params.jobId).order("created_at"),
      supabase.from("uploaded_files").select("id, file_name, file_type, file_size, processing_status, source_provenance, created_at").eq("job_id", params.jobId).order("created_at"),
    ]);

    if (jobRes.error) throw jobRes.error;
    if (propertyRes.error) throw propertyRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    if (pagesRes.error) throw pagesRes.error;
    if (filesRes.error) throw filesRes.error;

    const payload = {
      job: jobRes.data,
      property_data: cleanPropertyData(propertyRes.data),
      fields: fieldsRes.data || [],
      sources: {
        web_pages: pagesRes.data || [],
        files: filesRes.data || [],
      },
      meta: {
        has_property_data: Boolean(propertyRes.data),
        has_fields: (fieldsRes.data || []).length > 0,
        has_extraction_rows: Boolean(propertyRes.data) || (fieldsRes.data || []).length > 0,
        job_marked_complete: jobRes.data?.status === "extraction_complete" || jobRes.data?.extraction_status === "complete",
        source_counts: {
          web_pages: (pagesRes.data || []).length,
          files: (filesRes.data || []).length,
        },
      },
      generated_at: new Date().toISOString(),
    };

    const filename = safeFileName(payload.property_data?.property_name || payload.job?.property_name || payload.job?.property_url || "extraction");

    if (format === "md" || format === "markdown") {
      const markdown = extractionToMarkdown(payload);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          ...(download ? { "Content-Disposition": `attachment; filename=\"${filename}-extraction.md\"` } : {}),
        },
      });
    }

    return NextResponse.json(payload, {
      headers: download ? { "Content-Disposition": `attachment; filename=\"${filename}-extraction.json\"` } : {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load extraction" }, { status: 500 });
  }
}

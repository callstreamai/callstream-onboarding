"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import JobTabs from "@/components/project/JobTabs";
import { Spinner } from "@/components/ui/Spinner";
import { Download, FileJson, FileText, Search, Database, Globe, CheckCircle2, AlertCircle } from "lucide-react";

interface ExtractionPayload {
  job: any;
  property_data: Record<string, any> | null;
  fields: any[];
  sources: {
    web_pages: any[];
    files: any[];
  };
  meta?: {
    has_property_data: boolean;
    has_fields: boolean;
    has_extraction_rows: boolean;
    job_marked_complete: boolean;
    source_counts: { web_pages: number; files: number };
  };
  generated_at: string;
}

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

function confidenceColor(value?: number | null) {
  if (value === null || value === undefined) return "text-cs-text-muted";
  if (value >= 0.75) return "text-cs-accent-green";
  if (value >= 0.5) return "text-cs-accent-orange";
  return "text-cs-accent-red";
}

export default function ExtractionPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [data, setData] = useState<ExtractionPayload | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"fields" | "json" | "markdown">("fields");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [jsonRes, mdRes] = await Promise.all([
          fetch("/api/jobs/" + jobId + "/extraction"),
          fetch("/api/jobs/" + jobId + "/extraction?format=md"),
        ]);
        if (!jsonRes.ok) throw new Error("Failed to load extraction");
        const json = await jsonRes.json();
        setData(json);
        setMarkdown(mdRes.ok ? await mdRes.text() : "");
      } catch (err: any) {
        setError(err.message || "Failed to load extraction");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  const fields = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.fields || [];
    if (!q) return rows;
    return rows.filter((field) => {
      const hay = [field.field_name, JSON.stringify(field.extracted_value), JSON.stringify(field.edited_value), field.status]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.fields, query]);

  const propertyName = data?.property_data?.property_name || data?.job?.property_name || data?.job?.property_url || "Extraction";
  const confidence = data?.property_data?.confidence_score ?? data?.job?.extraction_confidence;
  const hasExtractionRows = Boolean(data?.meta?.has_extraction_rows ?? (data?.property_data || (data?.fields || []).length > 0));
  const jobMarkedComplete = Boolean(data?.meta?.job_marked_complete);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  }

  if (error) {
    return (
      <div>
        <JobTabs jobId={jobId} />
        <div className="cs-card p-8 text-center">
          <AlertCircle size={28} className="mx-auto text-cs-accent-red mb-3" />
          <p className="text-cs-text-primary font-medium">Could not load extraction</p>
          <p className="text-sm text-cs-text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data?.property_data && (!data?.fields || data.fields.length === 0) && !data?.meta?.job_marked_complete) {
    return (
      <div>
        <JobTabs jobId={jobId} />
        <div className="cs-card p-8 text-center">
          <Database size={32} className="mx-auto text-cs-text-muted mb-3" />
          <p className="text-cs-text-primary font-medium">No extraction data yet</p>
          <p className="text-sm text-cs-text-muted mt-1">Once the website scrape or document extraction completes, it will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <JobTabs jobId={jobId} propertyName={String(propertyName)} />

      <div className="cs-card p-6 overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cs-accent-blue via-cs-accent-purple to-cs-accent-green" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-lg bg-cs-accent-blue/10 flex items-center justify-center">
                <FileJson size={18} className="text-cs-accent-blue" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-cs-text-primary">Extraction</h1>
                <p className="text-xs text-cs-text-muted">Structured scrape and document extraction output</p>
              </div>
            </div>
            <h2 className="text-lg font-medium text-cs-text-primary mt-4">{propertyName}</h2>
            {data?.job?.property_url && (
              <a href={data.job.property_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cs-text-muted hover:text-cs-accent-blue mt-1">
                <Globe size={11} /> {data.job.property_url}
              </a>
            )}
            {!hasExtractionRows && jobMarkedComplete && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-cs-accent-orange/30 bg-cs-accent-orange/10 px-3 py-2">
                <AlertCircle size={14} className="text-cs-accent-orange mt-0.5 flex-shrink-0" />
                <p className="text-xs text-cs-accent-orange leading-relaxed">
                  This job is marked extraction complete, but the structured extraction rows are missing. Showing the source manifest available for re-extraction/review.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <a
              href={`/api/jobs/${jobId}/extraction?format=json&download=true`}
              className="cs-btn-secondary text-xs px-3 py-1.5"
            >
              <Download size={13} /> JSON
            </a>
            <a
              href={`/api/jobs/${jobId}/extraction?format=md&download=true`}
              className="cs-btn-primary text-xs px-3 py-1.5"
            >
              <Download size={13} /> Markdown
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
            <p className="cs-label text-[10px]">Confidence</p>
            <p className={"text-lg font-semibold mt-1 " + confidenceColor(Number(confidence))}>
              {confidence !== null && confidence !== undefined ? Math.round(Number(confidence) * 100) + "%" : "—"}
            </p>
          </div>
          <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
            <p className="cs-label text-[10px]">Fields</p>
            <p className="text-lg font-semibold text-cs-text-primary mt-1">{data.fields?.length || 0}</p>
          </div>
          <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
            <p className="cs-label text-[10px]">Web Sources</p>
            <p className="text-lg font-semibold text-cs-text-primary mt-1">{data.sources?.web_pages?.length || 0}</p>
          </div>
          <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
            <p className="cs-label text-[10px]">File Sources</p>
            <p className="text-lg font-semibold text-cs-text-primary mt-1">{data.sources?.files?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-1 bg-cs-card border border-cs-border rounded-lg p-1 w-fit">
          {(["fields", "json", "markdown"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={
                "px-3 py-1.5 text-xs rounded-md transition " +
                (view === key ? "bg-cs-accent-blue/10 text-cs-accent-blue" : "text-cs-text-muted hover:text-cs-text-secondary")
              }
            >
              {key === "fields" ? "Field View" : key === "json" ? "JSON" : "Markdown"}
            </button>
          ))}
        </div>

        {view === "fields" && (
          <div className="relative md:w-80">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search extracted fields..."
              className="cs-input pl-9 text-xs w-full"
            />
          </div>
        )}
      </div>

      {view === "fields" && (
        hasExtractionRows ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((field) => {
              const value = field.edited_value ?? field.extracted_value;
              const snippets = Array.isArray(field.source_snippets) ? field.source_snippets : [];
              return (
                <div key={field.id} className="cs-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-cs-text-primary">{titleize(field.field_name)}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={"text-[10px] " + confidenceColor(Number(field.confidence))}>
                          {field.confidence !== null && field.confidence !== undefined ? Math.round(Number(field.confidence) * 100) + "%" : "—"}
                        </span>
                        <span className="text-[10px] text-cs-text-muted">{field.status || "pending"}</span>
                      </div>
                    </div>
                    {field.status === "accepted" && <CheckCircle2 size={14} className="text-cs-accent-green" />}
                  </div>
                  <pre className="text-xs text-cs-text-secondary whitespace-pre-wrap break-words bg-cs-bg rounded-md border border-cs-border p-3 max-h-48 overflow-auto">
                    {formatValue(value)}
                  </pre>
                  {snippets.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="cs-label text-[10px]">Sources</p>
                      {snippets.slice(0, 3).map((snippet: any, index: number) => (
                        <p key={index} className="text-[11px] text-cs-text-muted line-clamp-2">
                          {snippet.source_name || "Source"}: {String(snippet.text || "").replace(/\s+/g, " ")}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cs-card p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-cs-accent-orange/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-cs-accent-orange" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-cs-text-primary">No structured extraction rows found</h3>
                <p className="text-sm text-cs-text-muted mt-1">
                  The job status says extraction is complete, but `property_data` and `extraction_fields` are empty for this project. You can still download the JSON/Markdown source manifest below, or rerun extraction to repopulate structured fields.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
                    <p className="cs-label text-[10px]">Available Web Sources</p>
                    <p className="text-lg font-semibold text-cs-text-primary mt-1">{data.sources?.web_pages?.length || 0}</p>
                  </div>
                  <div className="bg-cs-bg border border-cs-border rounded-lg p-3">
                    <p className="cs-label text-[10px]">Available File Sources</p>
                    <p className="text-lg font-semibold text-cs-text-primary mt-1">{data.sources?.files?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {view === "json" && (
        <div className="cs-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileJson size={15} className="text-cs-accent-blue" />
            <h3 className="text-sm font-medium text-cs-text-primary">Raw JSON</h3>
          </div>
          <pre className="text-xs text-cs-text-secondary whitespace-pre-wrap break-words bg-cs-bg rounded-lg border border-cs-border p-4 max-h-[650px] overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      {view === "markdown" && (
        <div className="cs-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-cs-accent-blue" />
            <h3 className="text-sm font-medium text-cs-text-primary">Markdown Export Preview</h3>
          </div>
          <pre className="text-xs text-cs-text-secondary whitespace-pre-wrap break-words bg-cs-bg rounded-lg border border-cs-border p-4 max-h-[650px] overflow-auto">
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}

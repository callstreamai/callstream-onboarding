import { isBlockedSource } from "./source-quality";
import type { createServiceClient } from "@/lib/supabase/server";
import { processFile } from "@/lib/ingest/file-processor";
import { fingerprint } from "@/lib/property-operations";
import type { KnowledgeSource } from "./generate";
type DB = ReturnType<typeof createServiceClient>;
export async function sourceInventory(db: DB, jobId: string) {
  const [pages, docs, files] = await Promise.all([
    db
      .from("crawled_pages")
      .select("id,url,title,content_text,status,error_message,created_at")
      .eq("job_id", jobId)
      .order("id"),
    db
      .from("space_documents")
      .select(
        "id,name,file_name,file_type,storage_path,extracted_text,created_at",
      )
      .eq("job_id", jobId)
      .order("id"),
    db
      .from("uploaded_files")
      .select("id,file_name,file_type,storage_path,extracted_text,created_at")
      .eq("job_id", jobId)
      .order("id"),
  ]);
  for (const r of [pages, docs, files]) if (r.error) throw r.error;
  const seen = new Set((docs.data || []).map((d) => d.storage_path));
  const documents = [
    ...(docs.data || []).map((d) => ({ ...d, table: "space_documents" })),
    ...(files.data || [])
      .filter((d) => !seen.has(d.storage_path))
      .map((d) => ({ ...d, name: d.file_name, table: "uploaded_files" })),
  ];
  const manifest = [
    ...(pages.data || []).map((p) => ({
      id: p.id,
      name: p.title || p.url,
      type: "web",
      version: fingerprint([p.status, p.content_text]),
      created_at: p.created_at,
    })),
    ...documents.map((d) => ({
      id: d.id,
      name: d.file_name,
      type: "file",
      version: d.storage_path,
      created_at: d.created_at,
    })),
  ];
  return {
    pages: pages.data || [],
    documents,
    manifest,
    hash: fingerprint(manifest),
  };
}
export async function readKnowledgeSources(
  db: DB,
  jobId: string,
  inventory: Awaited<ReturnType<typeof sourceInventory>>,
) {
  const sources: KnowledgeSource[] = inventory.pages
    .filter((p) => p.status === "fetched" && p.content_text?.trim() && !isBlockedSource(p.title||"",p.content_text||""))
    .map((p) => ({
      id: p.id,
      name: p.title || p.url,
      type: "web",
      content: p.content_text,
    }));
  const warnings: string[] = inventory.pages
    .filter((p) => p.status !== "fetched" || isBlockedSource(p.title||"",p.content_text||""))
    .map((p) => `${p.url}: this website page could not be read.`);
  for (const doc of inventory.documents) {
    let text = doc.extracted_text || "";
    if (!text || text.startsWith("[Image file")) {
      if (!doc.storage_path?.startsWith(`${jobId}/`))
        throw new Error("A document has an invalid storage path.");
      const { data, error } = await db.storage
        .from("onboarding-files")
        .download(doc.storage_path);
      if (error || !data)
        throw new Error(`Could not read ${doc.file_name}. Please try again.`);
      if (data.size > 25 * 1024 * 1024) {
        warnings.push(`${doc.file_name}: exceeds the 25 MB processing limit.`);
        continue;
      }
      const result = await processFile(
        Buffer.from(await data.arrayBuffer()),
        doc.file_name,
        doc.file_type || "",
      );
      text = result.extractedText;
      if (
        result.metadata.requiresOCR ||
        !text.trim() ||
        result.processingStatus === "failed"
      ) {
        warnings.push(
          `${doc.file_name}: no readable text. Upload a searchable PDF, DOCX, CSV, or text version.`,
        );
        await db
          .from(doc.table)
          .update({ processing_status: "failed" })
          .eq("id", doc.id)
          .eq("job_id", jobId);
        continue;
      }
      const { error: saveError } = await db
        .from(doc.table)
        .update({ extracted_text: text, processing_status: "complete" })
        .eq("id", doc.id)
        .eq("job_id", jobId);
      if (saveError) throw saveError;
    }
    sources.push({
      id: doc.id,
      name: doc.file_name,
      type: "file",
      content: text,
    });
  }
  return { sources, warnings };
}

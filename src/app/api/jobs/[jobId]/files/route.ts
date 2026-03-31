import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processFile } from "@/lib/ingest/file-processor";

// POST: Add supplemental files to an existing job
export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { jobId } = params;
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Verify job exists
    const { data: job } = await supabase
      .from("onboarding_jobs")
      .select("id, files_uploaded, files_processed")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let processed = 0;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${jobId}/supplemental-${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("onboarding-files")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`Upload failed for ${file.name}:`, uploadError);
        continue;
      }

      // Process file
      const result = await processFile(buffer, file.name, file.type);

      await supabase.from("uploaded_files").insert({
        job_id: jobId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        extracted_text: result.extractedText,
        metadata: result.metadata,
        processing_status: result.processingStatus,
        source_provenance: "supplemental_upload",
      });

      processed++;
    }

    // Update job file counts
    await supabase
      .from("onboarding_jobs")
      .update({
        files_uploaded: (job.files_uploaded || 0) + files.length,
        files_processed: (job.files_processed || 0) + processed,
      })
      .eq("id", jobId);

    return NextResponse.json({
      filesAdded: processed,
      message: "Files uploaded. Run re-extraction to include new content.",
    });
  } catch (err) {
    console.error("Supplemental upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// GET: List files for a job
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data: files } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("job_id", params.jobId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ files: files || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processFile } from "@/lib/ingest/file-processor";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();

    const propertyUrl = formData.get("propertyUrl") as string;
    const propertyName = formData.get("propertyName") as string | null;
    const vertical = formData.get("vertical") as string | null;
    const channels = JSON.parse(
      (formData.get("channels") as string) || '["voice","sms","webchat","whatsapp"]'
    );
    const userId = formData.get("userId") as string | null;
    const files = formData.getAll("files") as File[];

    // Find user's account
    let accountId: string | null = null;
    if (userId) {
      const { data: au } = await supabase
        .from("account_users")
        .select("account_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      if (au) accountId = au.account_id;
    }

    // Create onboarding job
    const { data: job, error: jobError } = await supabase
      .from("onboarding_jobs")
      .insert({
        property_url: propertyUrl,
        property_name: propertyName || null,
        account_id: accountId,
        vertical,
        status: "consent_given",
        consent_given: true,
        consent_at: new Date().toISOString(),
        files_uploaded: files.length,
        created_by: userId || null,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Process and upload files
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${job.id}/${file.name}`;

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

      const processed = await processFile(buffer, file.name, file.type);

      await supabase.from("uploaded_files").insert({
        job_id: job.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        extracted_text: processed.extractedText,
        metadata: processed.metadata,
        processing_status: processed.processingStatus,
        source_provenance: "upload",
      });
    }

    await supabase
      .from("onboarding_jobs")
      .update({
        status: "upload_complete",
        files_processed: files.length,
      })
      .eq("id", job.id);

    return NextResponse.json({ jobId: job.id, filesUploaded: files.length });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

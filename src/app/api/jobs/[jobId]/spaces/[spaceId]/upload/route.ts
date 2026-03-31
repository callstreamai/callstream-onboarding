import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string; spaceId: string } }
) {
  try {
    const supabase = createServiceClient();
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${params.jobId}/spaces/${params.spaceId}/${Date.now()}-${file.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("onboarding-files")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Create space_documents record
    const { data: doc, error: docError } = await supabase
      .from("space_documents")
      .insert({
        space_id: params.spaceId,
        job_id: params.jobId,
        name: file.name,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: storagePath,
        processing_status: "complete",
        uploaded_by: userId || null,
      })
      .select()
      .single();

    if (docError) {
      console.error("Document record error:", docError);
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // Also record in uploaded_files for dashboard visibility
    await supabase.from("uploaded_files").insert({
      job_id: params.jobId,
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      storage_path: storagePath,
      processing_status: "complete",
      source_provenance: "workspace",
    });

    return NextResponse.json({
      document: doc,
      path: storagePath,
    });
  } catch (err: any) {
    console.error("Workspace upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

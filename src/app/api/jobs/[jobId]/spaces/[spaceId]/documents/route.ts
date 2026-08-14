import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { jobId: string; spaceId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("space_documents")
      .select("*")
      .eq("job_id", params.jobId)
      .eq("space_id", params.spaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string; spaceId: string } }) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const { data, error } = await supabase
      .from("space_documents")
      .insert({
        space_id: params.spaceId,
        job_id: params.jobId,
        name: body.name,
        description: body.description || null,
        file_name: body.fileName,
        file_type: body.fileType,
        file_size: body.fileSize,
        storage_path: body.storagePath,
        uploaded_by: body.userId || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ document: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { jobId: string; spaceId: string } }) {
  try {
    const documentId = req.nextUrl.searchParams.get("id");
    if (!documentId) {
      return NextResponse.json({ error: "Document id required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: doc, error: fetchError } = await supabase
      .from("space_documents")
      .select("id, storage_path, file_name")
      .eq("id", documentId)
      .eq("job_id", params.jobId)
      .eq("space_id", params.spaceId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.storage_path) {
      await supabase.storage.from("onboarding-files").remove([doc.storage_path]);
      await supabase
        .from("uploaded_files")
        .delete()
        .eq("job_id", params.jobId)
        .eq("storage_path", doc.storage_path);
    }

    const { error: deleteError } = await supabase
      .from("space_documents")
      .delete()
      .eq("id", documentId)
      .eq("job_id", params.jobId)
      .eq("space_id", params.spaceId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete document" }, { status: 500 });
  }
}

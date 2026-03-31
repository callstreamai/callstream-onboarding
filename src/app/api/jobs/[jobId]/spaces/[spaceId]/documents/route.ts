import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { jobId: string; spaceId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("space_documents")
      .select("*")
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

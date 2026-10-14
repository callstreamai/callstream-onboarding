import { guardProject } from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const denied = await guardProject(params.jobId, false);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("spaces")
      .select("*, space_documents(id, name, file_name, file_type, file_size, storage_path, processing_status, created_at)")
      .eq("job_id", params.jobId)
      .order("sort_order");

    if (error) throw error;
    return NextResponse.json({ spaces: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  const denied = await guardProject(params.jobId, true);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    if (body.initDefaults) {
      const { requireUser } = await import("@/lib/access");
      const { user } = await requireUser();
      const { error } = await supabase.rpc("initialize_property_folders", { p_job: params.jobId, p_actor: user.id });
      if (error) throw error;
      const { data: spaces } = await supabase.from("spaces").select("*, space_documents(id,name,file_name,file_type,file_size,processing_status,created_at)").eq("job_id",params.jobId).order("sort_order");
      return NextResponse.json({ spaces });
    }

    const { data, error } = await supabase
      .from("spaces")
      .insert({
        job_id: params.jobId,
        name: body.name,
        description: body.description || null,
        icon: body.icon || "folder",
        sort_order: body.sort_order || 0,
        created_by: body.userId || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ space: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  const denied = await guardProject(params.jobId, true);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const { spaceId, icon, name, description } = await req.json();
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (icon !== undefined) updates.icon = icon;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from("spaces")
      .update(updates)
      .eq("id", spaceId)
      .eq("job_id", params.jobId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ space: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  const denied = await guardProject(params.jobId, true);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const spaceId = req.nextUrl.searchParams.get("spaceId");
    if (!spaceId) return NextResponse.json({ error: "spaceId required" }, { status: 400 });

    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id, name, job_id")
      .eq("id", spaceId)
      .eq("job_id", params.jobId)
      .single();

    if (spaceError || !space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const { data: docs, error: docsError } = await supabase
      .from("space_documents")
      .select("id, storage_path")
      .eq("space_id", spaceId)
      .eq("job_id", params.jobId);

    if (docsError) throw docsError;

    const storagePaths = (docs || []).map((doc: any) => doc.storage_path).filter(Boolean);
    if (storagePaths.length > 0) {
      await supabase.storage.from("onboarding-files").remove(storagePaths);
      await supabase
        .from("uploaded_files")
        .delete()
        .eq("job_id", params.jobId)
        .in("storage_path", storagePaths);
    }

    await supabase.from("space_links").delete().eq("space_id", spaceId);
    await supabase.from("space_documents").delete().eq("space_id", spaceId).eq("job_id", params.jobId);

    const { error: deleteError } = await supabase
      .from("spaces")
      .delete()
      .eq("id", spaceId)
      .eq("job_id", params.jobId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deletedSpaceId: spaceId,
      deletedFiles: storagePaths.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete space" }, { status: 500 });
  }
}

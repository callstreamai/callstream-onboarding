import { guardProject, requireProject, accessResponse, AccessError } from "@/lib/access";
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

function folderFields(body: Record<string, unknown>, requireName = false) {
  const fields: Record<string, string | null> = {};
  if (requireName || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120)
      throw new AccessError("Enter a folder name between 1 and 120 characters.", 400);
    fields.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 2000))
      throw new AccessError("Folder descriptions must be 2000 characters or fewer.", 400);
    fields.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body.icon !== undefined) {
    if (typeof body.icon !== "string" || !body.icon.trim() || body.icon.length > 64)
      throw new AccessError("Choose a valid folder icon.", 400);
    fields.icon = body.icon.trim();
  }
  return fields;
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const { db: supabase, user, isAdmin } = await requireProject(params.jobId);
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AccessError("Enter folder details.", 400);

    if (body.initDefaults) {
      if (!isAdmin) throw new AccessError("Only admins can initialize default folders.", 403);
      const { error } = await supabase.rpc("initialize_property_folders", { p_job: params.jobId, p_actor: user.id });
      if (error) throw error;
      const { data: spaces, error: spacesError } = await supabase.from("spaces").select("*, space_documents(id,name,file_name,file_type,file_size,processing_status,created_at)").eq("job_id",params.jobId).order("sort_order");
      if (spacesError) throw spacesError;
      return NextResponse.json({ spaces });
    }

    const { data, error } = await supabase
      .from("spaces")
      .insert({
        ...folderFields(body, true),
        job_id: params.jobId,
        icon: body.icon === undefined ? "folder" : body.icon.trim(),
        sort_order: 0,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ space: data });
  } catch (err: unknown) {
    return accessResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const { db: supabase } = await requireProject(params.jobId);
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AccessError("Enter folder details.", 400);
    if (typeof body.spaceId !== "string" || !body.spaceId)
      throw new AccessError("Choose a folder to edit.", 400);
    const updates = folderFields(body);
    if (!Object.keys(updates).length)
      throw new AccessError("Enter folder details to update.", 400);

    const { data, error } = await supabase
      .from("spaces")
      .update(updates)
      .eq("id", body.spaceId)
      .eq("job_id", params.jobId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new AccessError("Folder not found.", 404);
    return NextResponse.json({ space: data });
  } catch (err: unknown) {
    return accessResponse(err);
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

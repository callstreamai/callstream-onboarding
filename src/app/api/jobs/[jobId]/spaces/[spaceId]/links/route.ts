import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Ensure table exists
async function ensureTable(supabase: any) {
  try {
    await supabase.rpc("create_space_links_if_not_exists");
  } catch {}
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string; spaceId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("space_links")
      .select("*")
      .eq("space_id", params.spaceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ links: data || [] });
  } catch (_e) {
    return NextResponse.json({ links: [] });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string; spaceId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { title, url, description, userId } = await req.json();

    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "title and url required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("space_links")
      .insert({
        space_id: params.spaceId,
        job_id: params.jobId,
        title: title.trim(),
        url: url.trim(),
        description: description?.trim() || null,
        added_by: userId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ link: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { jobId: string; spaceId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get("id");

    if (!linkId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await supabase
      .from("space_links")
      .delete()
      .eq("id", linkId)
      .eq("space_id", params.spaceId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_SPACES = [
  { name: "Front Desk", description: "Check-in/out procedures, guest services, phone scripts", icon: "building" },
  { name: "Housekeeping", description: "Room cleaning SOPs, turnover procedures, supplies", icon: "home" },
  { name: "Food & Beverage", description: "Restaurant menus, bar programs, room service", icon: "utensils" },
  { name: "Reservations", description: "Booking policies, rate structures, packages", icon: "calendar" },
  { name: "Facilities", description: "Amenities, maintenance, property maps", icon: "settings" },
  { name: "Policies", description: "Pet, parking, cancellation, noise policies", icon: "file-text" },
  { name: "Training", description: "Staff training manuals, onboarding guides", icon: "book" },
  { name: "Marketing", description: "Brochures, promotions, brand guidelines", icon: "megaphone" },
  { name: "Event Calendar", description: "Property events, community activities, scheduled programming", icon: "calendar" },
];

// Default links to seed per space name
const DEFAULT_SPACE_LINKS: Record<string, { title: string; url: string; description?: string }[]> = {
  "Event Calendar": [
    {
      title: "Property Event Calendar",
      url: "https://online.flippingbook.com/view/1012294416/",
      description: "Interactive digital event calendar — view upcoming property events and activities",
    },
  ],
};

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
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
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    if (body.initDefaults) {
      const rows = DEFAULT_SPACES.map((s, i) => ({
        job_id: params.jobId,
        name: s.name,
        description: s.description,
        icon: s.icon,
        sort_order: i,
        created_by: body.userId || null,
      }));
      const { data, error } = await supabase.from("spaces").insert(rows).select();
      if (error) throw error;

      // Seed default links for spaces that have them
      const spaces = data || [];
      for (const space of spaces) {
        const defaultLinks = DEFAULT_SPACE_LINKS[space.name];
        if (defaultLinks && defaultLinks.length > 0) {
          const linkRows = defaultLinks.map((link) => ({
            space_id: space.id,
            job_id: params.jobId,
            title: link.title,
            url: link.url,
            description: link.description || null,
            added_by: body.userId || null,
          }));
          await supabase.from("space_links").insert(linkRows);
        }
      }

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

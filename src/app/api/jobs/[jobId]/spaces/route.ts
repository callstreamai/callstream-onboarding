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
];

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("spaces")
      .select("*, space_documents(id, name, file_name, file_type, processing_status, created_at)")
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
      return NextResponse.json({ spaces: data });
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

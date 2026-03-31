import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("full_name");

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("full_name");

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

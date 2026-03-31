import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data: accounts } = await supabase
      .from("accounts")
      .select("*, contacts(*)")
      .order("created_at", { ascending: false });

    return NextResponse.json({ accounts: accounts || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        name: body.name,
        property_url: body.property_url || null,
        vertical: body.vertical || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ account });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

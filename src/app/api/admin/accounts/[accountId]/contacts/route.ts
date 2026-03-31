import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        account_id: params.accountId,
        full_name: body.full_name,
        email: body.email || null,
        phone: body.phone || null,
        title: body.title || null,
        is_primary: body.is_primary || false,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ contact });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { contactId } = await req.json();

    await supabase.from("contacts").delete().eq("id", contactId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}

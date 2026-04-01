import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { accountId } = params;

    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("account_id", accountId)
      .order("is_primary", { ascending: false });

    const { data: jobs } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      account,
      contacts: contacts || [],
      jobs: jobs || [],
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const body = await req.json();

    const { error } = await supabase
      .from("accounts")
      .update(body)
      .eq("id", params.accountId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

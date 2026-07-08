import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const supabase = createServiceClient();
    const accountId = params.accountId;

    // Get account
    const { data: account, error: accError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accError || !account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get contacts
    const { data: contacts } = await supabase
      .from("account_contacts")
      .select("*")
      .eq("account_id", accountId)
      .order("is_primary", { ascending: false });

    // Get jobs linked by account_id
    const { data: linkedJobs } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    // Also find unlinked jobs that match by property name or URL (fallback)
    let unlinkedMatches: any[] = [];
    if (account.name || account.property_url) {
      let query = supabase
        .from("onboarding_jobs")
        .select("*")
        .is("account_id", null)
        .order("created_at", { ascending: false });

      const { data: allUnlinked } = await query;
      if (allUnlinked) {
        unlinkedMatches = allUnlinked.filter((job) => {
          const nameMatch = account.name && job.property_name &&
            job.property_name.toLowerCase().includes(account.name.toLowerCase().split(" ")[0]);
          const urlMatch = account.property_url && job.property_url &&
            job.property_url.includes(new URL(account.property_url).hostname);
          return nameMatch || urlMatch;
        });
      }
    }

    const jobs = [
      ...(linkedJobs || []),
      ...unlinkedMatches.map((j) => ({ ...j, _unlinked: true })),
    ];

    return NextResponse.json({
      account,
      contacts: contacts || [],
      jobs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const supabase = createServiceClient();
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const { error } = await supabase
      .from("onboarding_jobs")
      .update({ account_id: params.accountId })
      .eq("id", jobId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

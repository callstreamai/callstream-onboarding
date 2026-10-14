import {guardAdmin} from "@/lib/access";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  const denied=await guardAdmin();if(denied)return denied;
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
      .from("contacts")
      .select("*")
      .eq("account_id", accountId)
      .order("is_primary", { ascending: false });

    const {data:properties,error:propertyError}=await supabase.from("properties").select("*").order("created_at",{ascending:false});
    if(propertyError)throw propertyError;
    const jobs=(properties||[]).filter(p=>p.account_id===accountId||(!p.account_id&&(
      p.name.toLowerCase().trim()===account.name.toLowerCase().trim()||
      (account.property_url&&p.website_url.replace(/\/$/,"")===account.property_url.replace(/\/$/,""))
    ))).map(p=>({...p,id:p.workspace_job_id,property_name:p.name,property_url:p.website_url,status:"Property workspace",_unlinked:!p.account_id}));

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
  const denied=await guardAdmin();if(denied)return denied;
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

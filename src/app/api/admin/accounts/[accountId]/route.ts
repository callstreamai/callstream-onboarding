import { NextRequest, NextResponse } from "next/server";

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    "apikey": SB_KEY(),
    "Authorization": "Bearer " + SB_KEY(),
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  try {
    const accountId = params.accountId;

    const [accountRes, contactsRes, jobsRes] = await Promise.all([
      fetch(SB_URL() + "/rest/v1/accounts?id=eq." + accountId + "&select=*&limit=1", {
        headers: sbHeaders(), cache: "no-store",
      }),
      fetch(SB_URL() + "/rest/v1/account_contacts?account_id=eq." + accountId + "&select=*&order=is_primary.desc", {
        headers: sbHeaders(), cache: "no-store",
      }),
      fetch(SB_URL() + "/rest/v1/onboarding_jobs?account_id=eq." + accountId + "&select=*&order=created_at.desc", {
        headers: sbHeaders(), cache: "no-store",
      }),
    ]);

    const accounts = await accountRes.json();
    const contacts = await contactsRes.json();
    const jobs = await jobsRes.json();

    const account = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
    if (!account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      account,
      contacts: Array.isArray(contacts) ? contacts : [],
      jobs: Array.isArray(jobs) ? jobs : [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

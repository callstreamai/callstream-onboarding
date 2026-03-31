import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing config", jobs: [] }, { status: 500 });
    }

    // Use raw fetch to PostgREST - bypasses any Supabase JS client issues
    const res = await fetch(
      supabaseUrl + "/rest/v1/onboarding_jobs?select=*&order=created_at.desc",
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": "Bearer " + serviceKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText, jobs: [] }, { status: res.status });
    }

    const jobs = await res.json();
    return NextResponse.json({ jobs: jobs || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, jobs: [] }, { status: 500 });
  }
}

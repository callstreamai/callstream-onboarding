import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/profiles?select=id,email,full_name,role&order=full_name",
      {
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
          "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        cache: "no-store",
      }
    );
    const users = await res.json();
    return NextResponse.json({ users: Array.isArray(users) ? users : [] });
  } catch {
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}

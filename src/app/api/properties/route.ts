import { NextResponse } from "next/server";
import { listProperties } from "@/lib/properties";
import { accessResponse } from "@/lib/access";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { properties, isAdmin } = await listProperties();
    return NextResponse.json({ properties, isAdmin });
  } catch (e) {
    return accessResponse(e);
  }
}

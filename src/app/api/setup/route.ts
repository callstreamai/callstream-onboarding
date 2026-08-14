import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Setup endpoint is disabled. Users must be managed from the admin console." },
    { status: 403 }
  );
}

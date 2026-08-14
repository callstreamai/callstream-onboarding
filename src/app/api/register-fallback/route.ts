import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Self-registration is disabled. Users must be created by an administrator." },
    { status: 403 }
  );
}

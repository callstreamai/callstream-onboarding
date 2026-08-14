import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Event portal has been removed from this onboarding platform." },
    { status: 410 }
  );
}

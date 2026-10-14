import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { normalizeVoices, PreviewError } from "@/lib/voice-preview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: { user }, error } = await createServerSupabaseClient().auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    const apiKey = process.env.BLAND_API_KEY;
    if (!apiKey) throw new PreviewError("Voice previews are not configured. Please contact your administrator.", 503);
    const res = await fetch("https://api.bland.ai/v1/voices", { headers: { Authorization: apiKey }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new PreviewError("The voice library is temporarily unavailable. Please try again.");
    const voices = normalizeVoices(await res.json());
    return NextResponse.json({ voices }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Voice library failed", { type: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ error: error instanceof PreviewError ? error.message : "The voice library could not be loaded. Please try again." }, { status: error instanceof PreviewError ? error.status : 502 });
  }
}

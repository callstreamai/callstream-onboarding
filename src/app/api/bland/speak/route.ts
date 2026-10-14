import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { generatePreview, PreviewError, validatePreview } from "@/lib/voice-preview";

export async function POST(req: Request) {
  try {
    const { data: { user }, error } = await createServerSupabaseClient().auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    let body: unknown;
    try { body = await req.json(); } catch { throw new PreviewError("Please enter a valid preview request.", 400); }
    const input = validatePreview(body);
    const apiKey = process.env.BLAND_API_KEY;
    if (!apiKey) throw new PreviewError("Voice previews are not configured. Please contact your administrator.", 503);
    const audio = await generatePreview(apiKey, input);
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    const message = error instanceof PreviewError ? error.message : timeout ? "The preview took too long. Please try again or choose another voice." : "We could not connect to the voice service. Please try again.";
    const status = error instanceof PreviewError ? error.status : timeout ? 504 : 502;
    console.error("Voice preview failed", { status, type: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ error: message }, { status });
  }
}

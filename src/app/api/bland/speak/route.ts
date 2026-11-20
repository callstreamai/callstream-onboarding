import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { generatePreview, PreviewError, validatePreview } from "@/lib/voice-preview";

export async function POST(req: Request) {
  const started = Date.now();
  const suppliedId = req.headers.get("x-preview-id");
  const previewId = suppliedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const attempt = req.headers.get("x-preview-attempt") === "2" ? 2 : 1;
  let voice: string | undefined;
  let textLength: number | undefined;
  const timings: Record<string, number> = {};
  try {
    const { data: { user }, error } = await createServerSupabaseClient().auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    let body: unknown;
    try { body = await req.json(); } catch { throw new PreviewError("Please enter a valid preview request.", 400); }
    const input = validatePreview(body);
    voice = input.voice; textLength = input.text.length;
    const apiKey = process.env.BLAND_API_KEY;
    if (!apiKey) throw new PreviewError("Voice previews are not configured. Please contact your administrator.", 503);
    const audio = await generatePreview(apiKey, input, fetch, (phase, elapsedMs, status) => { timings[phase + "_ms"] = elapsedMs; if (status) timings.provider_status = status; });
    console.info("Voice preview server", { previewId, attempt, voice, textLength, ...timings, total_ms: Date.now() - started, outcome: "success", audio_bytes: audio.byteLength });
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Preview-Id": previewId } });
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    const message = error instanceof PreviewError ? error.message : timeout ? "The preview took too long. Please try again or choose another voice." : "We could not connect to the voice service. Please try again.";
    const status = error instanceof PreviewError ? error.status : timeout ? 504 : 502;
    console.error("Voice preview server", { previewId, attempt, voice, textLength, ...timings, total_ms: Date.now() - started, outcome: "error", status, type: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ error: message }, { status, headers: { "X-Preview-Id": previewId } });
  }
}

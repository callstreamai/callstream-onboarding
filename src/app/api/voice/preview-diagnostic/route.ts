import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { isVoiceId } from "@/lib/voice-preview";

// Only accept bounded, non-content metadata; never log the submitted body itself.
export async function POST(req: Request) {
  const { data: { user }, error } = await createServerSupabaseClient().auth.getUser();
  if (error || !user) return new Response(null, { status: 401 });
  let data: Record<string, unknown>;
  try { data = await req.json(); } catch { return new Response(null, { status: 400 }); }
  const bounded = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
  if (!data || typeof data.previewId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.previewId) || !isVoiceId(data.voice) || ![1, 2].includes(data.attempt as number) || !bounded(data.textLength, 300) || !bounded(data.totalMs, 180000) || (data.headersMs !== undefined && !bounded(data.headersMs, 180000)) || (data.status !== undefined && !bounded(data.status, 599)) || !["success", "error", "timeout", "cancelled"].includes(data.outcome as string)) return new Response(null, { status: 400 });
  console.info("Voice preview browser", { previewId: data.previewId, attempt: data.attempt, voice: data.voice, textLength: data.textLength, headers_ms: data.headersMs, total_ms: data.totalMs, status: data.status, outcome: data.outcome });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

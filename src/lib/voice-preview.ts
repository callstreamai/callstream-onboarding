export interface PreviewVoice {
  id: string;
  name: string;
  description: string;
  service: string;
  tags: string[];
  recommended: boolean;
}

export const isVoiceId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export class PreviewError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function validatePreview(body: unknown): { text: string; voice: string } {
  const input = body as Record<string, unknown> | null;
  if (!input || typeof input.text !== "string" || !input.text.trim() || input.text.length > 300 || !isVoiceId(input.voice)) {
    throw new PreviewError("Choose a voice and enter between 1 and 300 characters.", 400);
  }
  return { text: input.text.trim(), voice: input.voice };
}

export function normalizeVoices(data: unknown): PreviewVoice[] {
  const raw = Array.isArray(data) ? data : (data as { voices?: unknown })?.voices;
  if (!Array.isArray(raw)) throw new PreviewError("The voice library could not be loaded. Please try again.");
  const seen = new Set<string>();
  return raw.flatMap((v): PreviewVoice[] => {
    // `id` identifies a voice; `voice_id` identifies its underlying provider model.
    if (!v || !isVoiceId(v.id) || !["BTTS_V3", "BTTS_V2"].includes(v.service) || seen.has(v.id)) return [];
    seen.add(v.id);
    const tags = Array.isArray(v.tags) ? v.tags.filter((t: unknown): t is string => typeof t === "string") : [];
    return [{ id: v.id, name: typeof v.name === "string" ? v.name : "Untitled voice", description: typeof v.description === "string" ? v.description : "", service: v.service, tags, recommended: tags.some((t: string) => t.toLowerCase() === "bland curated") }];
  }).sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
}

export function providerError(status: number): PreviewError {
  if (status === 402) return new PreviewError("Voice previews are out of credits. Please contact your Call Stream administrator.", 503);
  if (status === 401 || status === 403) return new PreviewError("This voice is unavailable for this account. Try another voice or contact your administrator.", 503);
  if (status === 400 || status === 404) return new PreviewError("This voice cannot generate a preview. Please choose another voice.", 422);
  if (status === 429) return new PreviewError("The voice service is busy. Wait a moment, then try again.", 429);
  return new PreviewError("The voice service is temporarily unavailable. Please try again.");
}

export async function generatePreview(apiKey: string, input: { text: string; voice: string }, requestFetch: typeof fetch = fetch): Promise<ArrayBuffer> {
  const res = await requestFetch("https://api.bland.ai/v2/tts", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, audio: { encoding: "pcm_s16le", sample_rate: 48000, container: "wav" } }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!res.ok) throw providerError(res.status);
  const audio = await res.arrayBuffer();
  const bytes = new Uint8Array(audio);
  const signature = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.slice(start, end)));
  if (bytes.length <= 44 || signature(0, 4) !== "RIFF" || signature(8, 12) !== "WAVE") {
    throw new PreviewError("The voice service returned an unreadable preview. Please try another voice.");
  }
  return audio;
}

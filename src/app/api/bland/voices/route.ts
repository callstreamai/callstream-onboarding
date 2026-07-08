import { NextResponse } from "next/server";

// Fallback list — used when BLAND_API_KEY is absent or API returns nothing usable
const DEFAULT_VOICES = [
  { id: "maya",   name: "Maya",    description: "Young American Female" },
  { id: "ryan",   name: "Ryan",    description: "Professional American Male" },
  { id: "mason",  name: "Mason",   description: "American Male" },
  { id: "tina",   name: "Tina",    description: "Gentle American Female" },
  { id: "nat",    name: "Nat",     description: "Friendly, conversational" },
  { id: "june",   name: "June",    description: "Warm American Female" },
  { id: "karl",   name: "Karl",    description: "Steady American Male" },
  { id: "willow", name: "Willow",  description: "Soft American Female" },
  { id: "maeve",  name: "Maeve",   description: "Expressive American Female" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isV3(voiceId: string): boolean {
  return UUID_RE.test(voiceId ?? "");
}

function isCurated(v: any): boolean {
  return (v.tags ?? []).some((t: string) => t.toLowerCase() === "bland curated");
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*-\s*bland\s*$/i, "")   // strip "- Bland" suffix
    .replace(/\s*\(new\)\s*$/i, "")      // strip "(New)" suffix
    .replace(/\s*experimental\s*$/i, "") // strip "Experimental" suffix
    .replace(/\s*2\.0\s*$/i, "")         // strip "2.0" suffix
    .replace(/\s*new\s*$/i, "")          // strip trailing "New"
    .replace(/-+$/, "")                  // strip trailing dashes
    .trim()
    .replace(/^[a-z]/, (c) => c.toUpperCase()); // capitalise first letter
}

function isExcluded(name: string): boolean {
  // Skip non-name labels, test voices, non-Latin script
  if (/test/i.test(name)) return true;
  if (name === "French 1") return true;
  if (/[\u4E00-\u9FFF]/.test(name)) return true; // CJK characters
  return false;
}

export async function GET() {
  const apiKey = process.env.BLAND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }

  try {
    const res = await fetch("https://api.bland.ai/v1/voices", {
      headers: { Authorization: apiKey },
    });
    const data = await res.json();
    const raw: any[] = Array.isArray(data.voices) ? data.voices
      : Array.isArray(data) ? data : [];

    // 1. Keep only Bland Curated voices
    // 2. Clean names & exclude junk
    // 3. Deduplicate by name — prefer V3 (UUID) over older slug IDs
    interface VoiceEntry { id: string; name: string; description: string | null; preview_url: string | null; v3: boolean; }
    const byName = new Map<string, VoiceEntry>();

    for (const v of raw) {
      if (!isCurated(v)) continue;
      const rawName = v.name ?? "Unknown";
      const name = cleanName(rawName);
      if (isExcluded(name)) continue;

      const id: string = v.voice_id ?? v.id ?? rawName.toLowerCase();
      const v3 = isV3(id);

      if (!byName.has(name) || (v3 && !byName.get(name)!.v3)) {
        byName.set(name, {
          id,
          name,
          description: v.description ?? null,
          preview_url: v.preview_url ?? null,
          v3,
        });
      }
    }

    const voices = [...byName.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, description, preview_url }) => ({ id, name, description, preview_url }));

    return NextResponse.json({ voices: voices.length > 0 ? voices : DEFAULT_VOICES });
  } catch (_e) {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

import { NextResponse } from "next/server";

// Fallback list — used when BLAND_API_KEY is absent or API returns nothing usable
const DEFAULT_VOICES = [
  { id: "maya",   name: "Maya",   description: "Young American Female" },
  { id: "ryan",   name: "Ryan",   description: "Professional American Male" },
  { id: "mason",  name: "Mason",  description: "American Male" },
  { id: "tina",   name: "Tina",   description: "Gentle American Female" },
  { id: "nat",    name: "Nat",    description: "Friendly, conversational" },
  { id: "june",   name: "June",   description: "Warm American Female" },
  { id: "karl",   name: "Karl",   description: "Steady American Male" },
  { id: "willow", name: "Willow", description: "Soft American Female" },
  { id: "maeve",  name: "Maeve",  description: "Expressive American Female" },
];

function isCurated(v: any): boolean {
  const tags: string[] = v.tags || [];
  return tags.some((t: string) => t.toLowerCase() === "bland curated");
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*-\s*bland\s*$/i, "")
    .replace(/\s*\(new\)\s*$/i, "")
    .replace(/\s*experimental\s*$/i, "")
    .replace(/\s*2\.0\s*$/i, "")
    .replace(/\s*new\s*$/i, "")
    .replace(/-+$/, "")
    .trim()
    .replace(/^[a-z]/, (c: string) => c.toUpperCase());
}

function isExcluded(name: string): boolean {
  if (/test/i.test(name)) return true;
  if (name === "French 1") return true;
  if (/[\u4E00-\u9FFF]/.test(name)) return true;
  return false;
}

function isV3Id(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");
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

    // Filter to curated, clean names, remove excluded
    const cleaned = raw
      .filter((v: any) => isCurated(v))
      .map((v: any) => ({
        id: String(v.voice_id || v.id || v.name || ""),
        name: cleanName(String(v.name || "Unknown")),
        description: (v.description as string | null) || null,
        preview_url: (v.preview_url as string | null) || null,
        v3: isV3Id(String(v.voice_id || v.id || "")),
      }))
      .filter((v: any) => !isExcluded(v.name));

    // Deduplicate by name — keep V3 (UUID) over older slugs
    const seen: Record<string, boolean> = {};
    const deduped = cleaned
      .sort((a: any, b: any) => (b.v3 ? 1 : 0) - (a.v3 ? 1 : 0))
      .filter((v: any) => {
        if (seen[v.name]) return false;
        seen[v.name] = true;
        return true;
      })
      .map(({ id, name, description, preview_url }: any) => ({ id, name, description, preview_url }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices: deduped.length > 0 ? deduped : DEFAULT_VOICES });
  } catch {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

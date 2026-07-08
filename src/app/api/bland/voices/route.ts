import { NextResponse } from "next/server";

// Verified Bland Curated voices (V2 / V3 only) — used when no API key is set
const DEFAULT_VOICES = [
  { id: "maya",    name: "Maya",    description: "Young American Female" },
  { id: "ryan",    name: "Ryan",    description: "Professional American Male" },
  { id: "mason",   name: "Mason",   description: "American Male" },
  { id: "tina",    name: "Tina",    description: "Gentle American Female" },
  { id: "nat",     name: "Nat",     description: "Friendly, conversational" },
  { id: "june",    name: "June",    description: "Warm American Female" },
  { id: "karl",    name: "Karl",    description: "Steady American Male" },
  { id: "estella", name: "Estella", description: "Confident American Female" },
  { id: "karen",   name: "Karen",   description: "American Female" },
  { id: "willow",  name: "Willow",  description: "Soft American Female" },
  { id: "maeve",   name: "Maeve",   description: "Expressive American Female" },
  { id: "beige",   name: "Beige",   description: "Natural, expressive" },
];

function cleanVoices(raw: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  for (const v of raw) {
    const name: string = v.name || "";
    const desc: string = v.description || "";
    const nameLower = name.toLowerCase();
    const descLower = desc.toLowerCase();

    // Skip: anything with "bland" in name or description
    if (nameLower.includes("bland") || descLower.includes("bland")) continue;

    // Skip: experimental voices
    if (nameLower.includes("experimental")) continue;

    // Skip: rcv test clones (e.g. paige-rcv-01)
    if (nameLower.includes("rcv")) continue;

    // Skip: names with hash IDs in parentheses like "Jamacian (4fcf3e)"
    if (/\([a-f0-9]{6,}\)/i.test(name)) continue;

    // Skip: descriptions that are just "Voice: <name>" — raw/unformatted
    if (/^voice:/i.test(desc.trim())) continue;

    // Skip: names that are clearly numeric/internal codes (e.g. "French 1")
    // Keep French 1 actually — some clients may want multilingual; just deduplicate properly

    // Deduplicate by normalized name (case-insensitive, ignore trailing 'e' variants)
    // e.g. Paige vs Paigee, Allie vs Alliee, June vs Junee
    const normalized = nameLower.replace(/ee$/, "e").replace(/ie$/, "y").trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    result.push({
      id: v.voice_id || v.id || nameLower,
      name,
      description: desc || null,
      preview_url: v.preview_url || null,
    });
  }

  return result;
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

    const voices = cleanVoices(raw);
    return NextResponse.json({ voices: voices.length > 0 ? voices : DEFAULT_VOICES });
  } catch {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

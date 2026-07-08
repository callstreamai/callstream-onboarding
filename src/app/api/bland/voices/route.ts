import { NextResponse } from "next/server";

// Verified Bland Curated voices (V2 / V3 only)
// Source: Bland API docs, changelogs, and persona docs
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

function isValidVoice(v: any): boolean {
  const name = (v.name || "").toLowerCase();
  const desc = (v.description || "").toLowerCase();
  const tags: string[] = v.tags || [];
  // Remove anything with "bland" in name or description
  if (name.includes("bland") || desc.includes("bland")) return false;
  // Keep only V2/V3 tagged voices when BLAND_API_KEY is used
  // If tags present, require v2 or v3 tag (or Bland Curated which implies v2/v3)
  if (tags.length > 0) {
    const hasV2 = tags.some((t) => t.toLowerCase().includes("v2"));
    const hasV3 = tags.some((t) => t.toLowerCase().includes("v3"));
    const isCurated = tags.some((t) => t.toLowerCase().includes("bland curated"));
    if (!hasV2 && !hasV3 && !isCurated) return false;
  }
  return true;
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
    const raw: any[] = Array.isArray(data.voices) ? data.voices : (Array.isArray(data) ? data : []);

    const voices = raw
      .filter(isValidVoice)
      .map((v: any) => ({
        id: v.voice_id || v.id || String(v.name).toLowerCase(),
        name: v.name || "Unknown",
        description: v.description || null,
        preview_url: v.preview_url || null,
      }));

    return NextResponse.json({ voices: voices.length > 0 ? voices : DEFAULT_VOICES });
  } catch {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

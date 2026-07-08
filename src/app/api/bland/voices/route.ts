import { NextResponse } from "next/server";

// Verified Bland Curated voices (V2/V3) — fallback when no API key
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

function isCurated(v: any): boolean {
  const tags: string[] = v.tags || [];
  // Only show voices explicitly tagged "Bland Curated" — filters out all custom/cloned account voices
  return tags.some((t: string) => t.toLowerCase() === "bland curated");
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

    const voices = raw
      .filter(isCurated)
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

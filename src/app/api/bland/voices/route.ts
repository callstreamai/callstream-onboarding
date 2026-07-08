import { NextResponse } from "next/server";

// Fallback curated voice list when API key is absent or returns nothing
const DEFAULT_VOICES = [
  { id: "maya",    name: "Maya",    description: "Young American Female" },
  { id: "ryan",    name: "Ryan",    description: "Professional American Male" },
  { id: "mason",   name: "Mason",   description: "American Male" },
  { id: "tina",    name: "Tina",    description: "Gentle American Female" },
  { id: "nat",     name: "Nat",     description: "Friendly, conversational" },
  { id: "june",    name: "June",    description: "Warm American Female" },
  { id: "karl",    name: "Karl",    description: "Steady American Male" },
  { id: "estella", name: "Estella", description: "Confident American Female" },
  { id: "willow",  name: "Willow",  description: "Soft American Female" },
  { id: "maeve",   name: "Maeve",   description: "Expressive American Female" },
];

function isCurated(v: any): boolean {
  const tags: string[] = v.tags || [];
  return tags.some((t: string) => t.toLowerCase() === "bland curated");
}

function isTest(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("test") || lower.startsWith("test ");
}

function cleanName(name: string): string {
  // Strip "- Bland" suffix and trim whitespace
  return name.replace(/\s*-\s*bland\s*$/i, "").trim();
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
      .filter((v: any) => !isTest(v.name || ""))
      .map((v: any) => ({
        id: v.voice_id || v.id || String(v.name).toLowerCase(),
        name: cleanName(v.name || "Unknown"),
        description: v.description || null,
        preview_url: v.preview_url || null,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ voices: voices.length > 0 ? voices : DEFAULT_VOICES });
  } catch {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

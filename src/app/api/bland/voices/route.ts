import { NextResponse } from "next/server";

const DEFAULT_VOICES = [
  { id: "maya", name: "Maya", description: "Young American Female" },
  { id: "ryan", name: "Ryan", description: "Professional American Male" },
  { id: "mason", name: "Mason", description: "American Male" },
  { id: "nat", name: "Nat", description: "Friendly, conversational" },
  { id: "tina", name: "Tina", description: "Gentle American Female" },
  { id: "evelyn", name: "Evelyn", description: "Refined, professional" },
  { id: "adriana", name: "Adriana", description: "Energetic, engaging" },
  { id: "jen", name: "Jen", description: "Approachable, natural" },
  { id: "derek", name: "Derek", description: "Deep American Male" },
  { id: "sophie", name: "Sophie", description: "Bright British Female" },
  { id: "oliver", name: "Oliver", description: "Warm British Male" },
  { id: "isabella", name: "Isabella", description: "Smooth American Female" },
  { id: "ethan", name: "Ethan", description: "Confident American Male" },
  { id: "grace", name: "Grace", description: "Southern American Female" },
  { id: "jake", name: "Jake", description: "Casual American Male" },
  { id: "aria", name: "Aria", description: "Clear American Female" },
  { id: "daniel", name: "Daniel", description: "Australian Male" },
  { id: "emma", name: "Emma", description: "Australian Female" },
  { id: "carlos", name: "Carlos", description: "American Spanish Accent Male" },
  { id: "luna", name: "Luna", description: "Soft American Female" },
  { id: "marcus", name: "Marcus", description: "Authoritative American Male" },
  { id: "stella", name: "Stella", description: "Expressive American Female" },
];

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
    const raw = data.voices || data || [];
    const voices = (Array.isArray(raw) ? raw : []).map((v: any) => ({
      id: v.voice_id || v.id || String(v.name).toLowerCase(),
      name: v.name || v.voice_name || "Unknown",
      description: v.description || null,
      preview_url: v.preview_url || null,
    }));
    return NextResponse.json({ voices: voices.length > 0 ? voices : DEFAULT_VOICES });
  } catch {
    return NextResponse.json({ voices: DEFAULT_VOICES });
  }
}

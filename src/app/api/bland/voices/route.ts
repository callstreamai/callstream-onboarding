import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.BLAND_API_KEY;

  if (!apiKey) {
    // Default voices when no key configured
    return NextResponse.json({
      voices: [
        { id: "nat", name: "Nat", description: "Friendly, conversational" },
        { id: "maya", name: "Maya", description: "Professional, warm" },
        { id: "ryan", name: "Ryan", description: "Clear, calm" },
        { id: "adriana", name: "Adriana", description: "Energetic, engaging" },
        { id: "evelyn", name: "Evelyn", description: "Refined, professional" },
        { id: "jen", name: "Jen", description: "Approachable, natural" },
      ],
    });
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
    return NextResponse.json({ voices });
  } catch {
    return NextResponse.json({ voices: [] }, { status: 500 });
  }
}

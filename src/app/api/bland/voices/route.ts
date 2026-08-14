import { NextResponse } from "next/server";

function isV3Id(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");
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
  if (!name || /test/i.test(name)) return true;
  if (name === "French 1") return true;
  if (/[\u4E00-\u9FFF]/.test(name)) return true;

  const normalized = name.toLowerCase();
  const businessOrCustomTerms = [
    "vision",
    "insurance",
    "conversational",
    "sales",
    "hpp",
    "voice_",
    "_voice",
  ];

  if (businessOrCustomTerms.some((term) => normalized.includes(term))) return true;
  if (name.includes("|")) return true;
  if (name.includes("_")) return true;
  if (/\b[a-z]+\s+[a-z]\.$/i.test(name)) return true;

  return false;
}

export async function GET() {
  const apiKey = process.env.BLAND_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ voices: [] });
  }

  try {
    const res = await fetch("https://api.bland.ai/v1/voices", {
      headers: { Authorization: apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ voices: [] });
    }

    const data = await res.json();
    const raw: any[] = Array.isArray(data.voices) ? data.voices : Array.isArray(data) ? data : [];

    const voices = raw
      .map((v: any) => {
        const id = String(v.voice_id || v.id || "");
        const name = cleanName(String(v.name || "Unknown"));
        return {
          id,
          name,
          description: (v.description as string | null) || "V3 voice",
        };
      })
      .filter((v) => isV3Id(v.id))
      .filter((v) => !isExcluded(v.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    const seen: Record<string, boolean> = {};
    const deduped = voices.filter((v) => {
      const key = v.name.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return NextResponse.json({ voices: deduped });
  } catch {
    return NextResponse.json({ voices: [] });
  }
}

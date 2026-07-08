import { NextRequest, NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { text, voice } = await req.json();

  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const apiKey = process.env.BLAND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BLAND_API_KEY not configured" }, { status: 503 });
  }

  // Bland API uses "voice_id" for UUID-format voices (V3 clones / Experimental)
  // and "voice" for short-slug Beige voices
  const isUUID = UUID_RE.test(voice || "");
  const payload = isUUID
    ? { text, voice_id: voice }
    : { text, voice: voice || "karl" };

  try {
    const res = await fetch("https://api.bland.ai/v1/speak", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "audio/wav";

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

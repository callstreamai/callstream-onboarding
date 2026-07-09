import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const jobIds = req.nextUrl.searchParams.get("jobIds");

    if (!jobIds) {
      return NextResponse.json({ words: [], linkCounts: {} });
    }

    const ids = jobIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ words: [], linkCounts: {} });
    }

    // Get space documents for these jobs
    const { data: spaces } = await supabase
      .from("spaces")
      .select("id, job_id, name, space_documents(name, processing_status)")
      .in("job_id", ids);

    // Get space links for these jobs
    const { data: links } = await supabase
      .from("space_links")
      .select("job_id, title, url")
      .in("job_id", ids);

    // Count links per job
    const linkCounts: Record<string, number> = {};
    for (const id of ids) linkCounts[id] = 0;
    (links || []).forEach((l: any) => {
      if (l.job_id) linkCounts[l.job_id] = (linkCounts[l.job_id] || 0) + 1;
    });

    // Build word frequency map
    const freq: Record<string, number> = {};
    const stopwords = new Set([
      "the", "and", "for", "with", "this", "that", "from", "are", "was",
      "pdf", "doc", "docx", "jpg", "png", "mp4", "csv", "xlsx", "txt",
      "a", "an", "of", "to", "in", "is", "it", "at", "by", "on", "or",
      "be", "as", "do", "if", "we", "so", "up", "my", "go", "no",
    ]);

    function addWords(text: string, weight: number = 1) {
      if (!text) return;
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopwords.has(w));
      for (const word of words) {
        freq[word] = (freq[word] || 0) + weight;
      }
    }

    // Add document names
    for (const space of spaces || []) {
      for (const doc of (space as any).space_documents || []) {
        // Strip file extension
        const name = (doc.name || "").replace(/\.[^.]+$/, "");
        addWords(name, doc.processing_status === "complete" ? 2 : 1);
      }
    }

    // Add link titles
    for (const link of links || []) {
      addWords((link as any).title || "", 2);
    }

    // Sort by frequency and take top 50
    const words = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50)
      .map(([text, weight]) => ({ text, weight }));

    return NextResponse.json({ words, linkCounts });
  } catch (e: any) {
    return NextResponse.json({ words: [], linkCounts: {}, error: e.message });
  }
}

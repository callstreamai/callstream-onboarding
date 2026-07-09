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
    ids.forEach((id) => { linkCounts[id] = 0; });
    (links || []).forEach((l) => {
      const jobId = (l as Record<string, string>)["job_id"];
      if (jobId) linkCounts[jobId] = (linkCounts[jobId] || 0) + 1;
    });

    // Build word frequency map
    const freq: Record<string, number> = {};
    const stopwords = new Set([
      "the", "and", "for", "with", "this", "that", "from", "are", "was",
      "pdf", "doc", "docx", "jpg", "png", "mp4", "csv", "xlsx", "txt",
      "a", "an", "of", "to", "in", "is", "it", "at", "by", "on", "or",
      "be", "as", "do", "if", "we", "so", "up", "my", "go", "no",
    ]);

    const addWords = (text: string, weight: number) => {
      if (!text) return;
      const wordList = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopwords.has(w));
      wordList.forEach((word) => {
        freq[word] = (freq[word] || 0) + weight;
      });
    };

    // Add document names from spaces
    (spaces || []).forEach((space) => {
      const spaceAny = space as Record<string, unknown>;
      const docs = (spaceAny["space_documents"] as Array<Record<string, string>> | null) || [];
      docs.forEach((doc) => {
        const name = (doc["name"] || "").replace(/\.[^.]+$/, "");
        addWords(name, doc["processing_status"] === "complete" ? 2 : 1);
      });
    });

    // Add link titles
    (links || []).forEach((link) => {
      addWords(((link as Record<string, string>)["title"]) || "", 2);
    });

    // Sort by frequency and take top 50
    const words = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([text, weight]) => ({ text, weight }));

    return NextResponse.json({ words, linkCounts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ words: [], linkCounts: {}, error: msg });
  }
}

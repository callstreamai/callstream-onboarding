import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const blandKey = process.env.BLAND_API_KEY || "";

  // Check Supabase by doing a lightweight query
  let supabaseOk = false;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    supabaseOk = !error;
  } catch {
    supabaseOk = false;
  }

  // OpenAI — just check key is present and looks valid
  const openaiOk = openaiKey.startsWith("sk-") && openaiKey.length > 20;

  // Bland — just check key is present
  const blandOk = blandKey.length > 10;

  return NextResponse.json({
    supabase: supabaseOk,
    supabaseUrl,
    openai: openaiOk,
    bland: blandOk,
  });
}

import OpenAI from "openai";
import { PROPERTY_EXTRACTION_SCHEMA } from "./schema";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  CONFIDENCE_PROMPT,
} from "./prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ExtractionSource {
  type: "web" | "file";
  id: string;
  name: string;
  content: string;
}

export interface ExtractionResult {
  data: Record<string, unknown>;
  confidence: Record<string, number>;
  overallConfidence: number;
  sourceMapping: Record<string, string[]>;
}

export async function extractPropertyData(
  sources: ExtractionSource[]
): Promise<ExtractionResult> {
  // Step 1: Extract structured data
  const extractionPrompt = buildExtractionPrompt(sources);

  const extractionResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: extractionPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4000,
  });

  const extractedData = JSON.parse(
    extractionResponse.choices[0]?.message?.content || "{}"
  );

  // Step 2: Get confidence scores
  const confidencePrompt = `Given this extracted data:\n${JSON.stringify(extractedData, null, 2)}\n\nAnd these source materials:\n${sources.map((s) => \`[\${s.type}] \${s.name}: \${s.content.slice(0, 2000)}\`).join("\n")}\n\n${CONFIDENCE_PROMPT}`;

  const confidenceResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a data quality assessor. Return only valid JSON." },
      { role: "user", content: confidencePrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1000,
  });

  const confidence: Record<string, number> = JSON.parse(
    confidenceResponse.choices[0]?.message?.content || "{}"
  );

  // Calculate overall confidence
  const scores = Object.values(confidence).filter((v) => typeof v === "number");
  const overallConfidence =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Build source mapping (simplified)
  const sourceMapping: Record<string, string[]> = {};
  for (const key of Object.keys(extractedData)) {
    sourceMapping[key] = sources.map((s) => s.id);
  }

  return {
    data: extractedData,
    confidence,
    overallConfidence,
    sourceMapping,
  };
}

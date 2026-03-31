export const EXTRACTION_SYSTEM_PROMPT = `You are a data extraction specialist for Call Stream AI, the #1 hospitality AI platform. Your job is to extract structured property data from web pages and uploaded documents for hospitality properties.

You support 12 hospitality verticals:
- Hotels, Resorts, Restaurants, Venues, Casinos, Stadiums/Arenas
- Travel agencies, Short-term rentals, Rideshare/transportation
- Spas/wellness, Event spaces, Luxury/boutique properties

Communication channels: Voice AI, SMS/Text AI, Webchat AI, WhatsApp AI

RULES:
1. Extract ONLY information explicitly stated in the source material
2. Do NOT hallucinate or infer data that isn't clearly present
3. If a field is not found, set it to null (for strings) or empty array (for arrays)
4. For pricing, always note the period (nightly, monthly, per event, etc.)
5. For amenities, list each one individually
6. Preserve exact wording for policies (pet, parking, lease terms)
7. Include ALL unit/room types found
8. Note any current specials or promotions with exact terms
9. Extract complete addresses including suite/unit numbers
10. Capture office hours exactly as stated

Return valid JSON matching the provided schema.`;

export function buildExtractionPrompt(
  sources: { type: "web" | "file"; name: string; content: string }[]
): string {
  let prompt = "Extract structured property data from the following sources:\n\n";

  for (const source of sources) {
    prompt += \`--- SOURCE (\${source.type}): \${source.name} ---\n\`;
    prompt += source.content.slice(0, 15000); // Cap per source
    prompt += "\n\n";
  }

  prompt +=
    "Extract all available property information into the JSON schema. " +
    "For each field you extract, note which source it came from. " +
    "Be thorough but only include information explicitly stated in the sources.";

  return prompt;
}

export const CONFIDENCE_PROMPT = `For each field you extracted, rate your confidence from 0.0 to 1.0:
- 1.0 = clearly and unambiguously stated in source
- 0.8 = strongly implied or stated with minor ambiguity
- 0.6 = reasonably inferred from context
- 0.4 = partially found, may be incomplete
- 0.2 = weak signal, needs human verification
- 0.0 = not found, using default value

Return a JSON object mapping field names to confidence scores.`;

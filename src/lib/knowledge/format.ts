export interface QA {
  question: string;
  answer: string;
  sources: string[];
}
export function validateQA(value: unknown, sourceIds: Set<string>): QA[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("No supported answers were generated.");
  return value.map((row) => {
    if (
      !row ||
      typeof row.question !== "string" ||
      !row.question.trim() ||
      typeof row.answer !== "string" ||
      !row.answer.trim() ||
      !Array.isArray(row.sources) ||
      !row.sources.length ||
      row.sources.some(
        (id: unknown) => typeof id !== "string" || !sourceIds.has(id),
      )
    )
      throw new Error(
        "An answer could not be traced to its source. Please regenerate the draft.",
      );
    return {
      question: row.question.trim(),
      answer: row.answer.trim(),
      sources: Array.from(new Set<string>(row.sources)),
    };
  });
}
export function toCSV(rows: QA[]) {
  const cell = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  return (
    "Question,Answer\r\n" +
    rows.map((r) => cell(r.question) + "," + cell(r.answer)).join("\r\n") +
    "\r\n"
  );
}
export function toKnowledgeText(rows: QA[]) {
  return rows
    .map((r) => `Question: ${r.question}\nAnswer: ${r.answer}`)
    .join("\n\n");
}

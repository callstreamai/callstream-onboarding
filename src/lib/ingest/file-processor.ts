import { extractPDFText } from "./pdf-extractor";

export interface ProcessedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedText: string;
  metadata: Record<string, unknown>;
  processingStatus: "complete" | "failed";
  error?: string;
}

export async function processFile(
  file: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedFile> {
  const base: Omit<ProcessedFile, "extractedText" | "metadata" | "processingStatus"> = {
    fileName,
    fileType: mimeType,
    fileSize: file.length,
  };

  try {
    // PDF
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const result = await extractPDFText(file);
      return {
        ...base,
        extractedText: result.text,
        metadata: {
          pages: result.pages,
          ...result.metadata,
        },
        processingStatus: "complete",
      };
    }

    if (fileName.toLowerCase().endsWith(".docx")) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer: file });
      return { ...base, extractedText: result.value, metadata: {}, processingStatus: result.value.trim() ? "complete" : "failed" };
    }

    // Plain text / markdown / CSV
    if (
      mimeType.startsWith("text/") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md") ||
      fileName.endsWith(".csv")
    ) {
      const text = file.toString("utf-8");
      return {
        ...base,
        extractedText: text,
        metadata: { encoding: "utf-8" },
        processingStatus: "complete",
      };
    }

    // Images - store path, extraction deferred to LLM
    if (mimeType.startsWith("image/")) {
      return {
        ...base,
        extractedText: "",
        metadata: { requiresOCR: true },
        processingStatus: "failed",
      };
    }

    // Unsupported type - store raw
    return {
      ...base,
      extractedText: "",
      metadata: { unsupported: true },
      processingStatus: "failed",
    };
  } catch (err) {
    return {
      ...base,
      extractedText: "",
      metadata: {},
      processingStatus: "failed",
      error: err instanceof Error ? err.message : "Processing failed",
    };
  }
}

import pdf from "pdf-parse";

export interface PDFExtractionResult {
  text: string;
  pages: number;
  metadata: {
    title: string | null;
    author: string | null;
    subject: string | null;
    creator: string | null;
    producer: string | null;
  };
}

export async function extractPDFText(
  buffer: Buffer
): Promise<PDFExtractionResult> {
  try {
    const data = await pdf(buffer);

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        title: data.info?.Title || null,
        author: data.info?.Author || null,
        subject: data.info?.Subject || null,
        creator: data.info?.Creator || null,
        producer: data.info?.Producer || null,
      },
    };
  } catch (err) {
    throw new Error(
      `PDF extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }
}

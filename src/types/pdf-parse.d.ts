declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, string>;
    metadata: Record<string, unknown>;
    version: string;
    text: string;
  }

  function pdf(buffer: Buffer): Promise<PDFData>;
  export = pdf;
}

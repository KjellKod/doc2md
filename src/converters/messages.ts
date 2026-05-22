import type { ConversionResult } from "./types";

export const UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Choose a supported document, spreadsheet, PDF, presentation, text, HTML, or Markdown file.";
export const CORRUPT_FILE_MESSAGE =
  "We couldn't read this file. Save a fresh copy from the source app, then import it again.";
export const SCANNED_PDF_MESSAGE =
  "This PDF appears to be scanned, so there is no selectable text to convert. Run OCR first, then import the searchable PDF.";
export const LOW_QUALITY_PDF_MESSAGE =
  "Conversion completed, but this PDF layout is likely to produce imperfect Markdown. Please review before use.";
export const OVERSIZED_FILE_MESSAGE =
  "This file is too large for reliable in-browser conversion. Try a smaller file or use @doc2md/core locally.";
export const EMPTY_FILE_MESSAGE =
  "This file is empty. Add content, then import it again.";
export const MAX_BROWSER_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const CONVERSION_TIMEOUT_MS = 60_000;
export const TIMEOUT_MESSAGE =
  "Conversion timed out. Try a smaller file or use @doc2md/core locally.";

export function formatImageCountNote(count: number): string {
  return ` ${count} image(s) detected that could not be converted to markdown.`;
}

export function createErrorResult(message: string): ConversionResult {
  return {
    markdown: "",
    warnings: [message],
    status: "error"
  };
}

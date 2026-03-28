import type { ConversionResult } from "./types";

export const UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Please upload one of the supported formats.";
export const CORRUPT_FILE_MESSAGE =
  "We couldn't read this file. It may be corrupted or use a structure not supported by this tool.";
export const SCANNED_PDF_MESSAGE =
  "This PDF appears to be image-based. Scanned PDFs are not supported in this version.";
export const LOW_QUALITY_PDF_MESSAGE =
  "Conversion completed, but this PDF layout is likely to produce imperfect Markdown. Please review before use.";
export const OVERSIZED_FILE_MESSAGE =
  "This file is too large for reliable in-browser conversion in this version.";
export const EMPTY_FILE_MESSAGE = "This file appears to be empty.";
export const MAX_BROWSER_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function createErrorResult(message: string): ConversionResult {
  return {
    markdown: "",
    warnings: [message],
    status: "error"
  };
}

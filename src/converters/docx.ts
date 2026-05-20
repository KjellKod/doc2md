import { convertDocxToHtml } from "./office";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult,
  formatImageCountNote
} from "./messages";
import { convertHtmlFragmentToMarkdown } from "./richText";
import { readFileAsArrayBuffer } from "./readBinary";
import type { ConversionResult, Converter } from "./types";

export const convertDocx: Converter = async (file) => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await convertDocxToHtml(arrayBuffer);
    const warnings = result.messages.map((message) => message.message);
    const markdown = convertHtmlFragmentToMarkdown(result.value);

    if (markdown.length === 0 && result.imageCount === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    const hasImages = result.imageCount > 0;
    const status: ConversionResult["status"] =
      warnings.length > 0 || hasImages ? "warning" : "success";

    const quality = hasImages
      ? {
          level: "review" as const,
          summary:
            "Review: Document converted." + formatImageCountNote(result.imageCount)
        }
      : undefined;

    return {
      markdown,
      warnings,
      status,
      ...(quality ? { quality } : {})
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};

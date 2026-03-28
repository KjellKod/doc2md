import { convertDocxToHtml } from "./office";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import { convertHtmlFragmentToMarkdown } from "./richText";
import { readFileAsArrayBuffer } from "./readBinary";
import type { Converter } from "./types";

export const convertDocx: Converter = async (file) => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await convertDocxToHtml(arrayBuffer);
    const warnings = result.messages.map((message) => message.message);
    const markdown = convertHtmlFragmentToMarkdown(result.value);

    if (markdown.length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    return {
      markdown,
      warnings,
      status: warnings.length > 0 ? "warning" : "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};

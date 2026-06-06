import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  JSON_VALIDATION_FAILED_MESSAGE,
  createErrorResult
} from "./messages";
import type { ConversionResult, Converter } from "./types";
import { readFileAsText } from "./readText";

export function convertJsonText(raw: string): ConversionResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return createErrorResult(EMPTY_FILE_MESSAGE);
  }

  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed, null, 2);

    return {
      markdown: `\`\`\`json\n${formatted}\n\`\`\``,
      warnings: [],
      status: "success",
      quality: {
        level: "good",
        summary: "Good: JSON validation passed and formatting completed."
      }
    };
  } catch {
    return {
      markdown: `\`\`\`json\n${raw}\n\`\`\``,
      warnings: [JSON_VALIDATION_FAILED_MESSAGE],
      status: "warning",
      quality: {
        level: "poor",
        summary: `Poor: ${JSON_VALIDATION_FAILED_MESSAGE}`
      }
    };
  }
}

export const convertJson: Converter = async (file) => {
  let raw: string;

  try {
    raw = await readFileAsText(file);
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }

  return convertJsonText(raw);
};

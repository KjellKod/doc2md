import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import type { Converter } from "./types";
import { readFileAsText } from "./readText";

export const convertJson: Converter = async (file) => {
  try {
    const raw = (await readFileAsText(file)).trim();

    if (raw.length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    const parsed = JSON.parse(raw);
    const formatted = JSON.stringify(parsed, null, 2);

    return {
      markdown: `\`\`\`json\n${formatted}\n\`\`\``,
      warnings: [],
      status: "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};

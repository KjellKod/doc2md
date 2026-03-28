import type { Converter } from "./types";
import { readFileAsText } from "./readText";

const EMPTY_JSON_MESSAGE = "This JSON file is empty.";
const INVALID_JSON_MESSAGE =
  "This JSON file could not be parsed. Please check that it is valid JSON.";

export const convertJson: Converter = async (file) => {
  try {
    const raw = (await readFileAsText(file)).trim();

    if (raw.length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_JSON_MESSAGE],
        status: "error"
      };
    }

    const parsed = JSON.parse(raw);
    const formatted = JSON.stringify(parsed, null, 2);

    return {
      markdown: `\`\`\`json\n${formatted}\n\`\`\``,
      warnings: [],
      status: "success"
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        markdown: "",
        warnings: [INVALID_JSON_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown: "",
      warnings: ["This JSON file could not be read."],
      status: "error"
    };
  }
};

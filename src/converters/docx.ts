import { convertDocxToHtml } from "./office";
import { convertHtmlFragmentToMarkdown } from "./richText";
import { readFileAsArrayBuffer } from "./readBinary";
import type { Converter } from "./types";

const EMPTY_DOCX_MESSAGE = "This DOCX file did not contain any extractable text.";
const INVALID_DOCX_MESSAGE =
  "This DOCX file could not be read. It may be corrupted or use unsupported content.";

export const convertDocx: Converter = async (file) => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await convertDocxToHtml(arrayBuffer);
    const warnings = result.messages.map((message) => message.message);
    const markdown = convertHtmlFragmentToMarkdown(result.value);

    if (markdown.length === 0) {
      return {
        markdown: "",
        warnings: warnings.length > 0 ? warnings : [EMPTY_DOCX_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown,
      warnings,
      status: warnings.length > 0 ? "warning" : "success"
    };
  } catch {
    return {
      markdown: "",
      warnings: [INVALID_DOCX_MESSAGE],
      status: "error"
    };
  }
};

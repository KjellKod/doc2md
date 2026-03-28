import { readFileAsText } from "./readText";
import { convertHtmlFragmentToMarkdown } from "./richText";
import type { Converter } from "./types";

const EMPTY_HTML_MESSAGE = "This HTML file is empty.";

export const convertHtml: Converter = async (file) => {
  try {
    const contents = await readFileAsText(file);

    if (contents.trim().length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_HTML_MESSAGE],
        status: "error"
      };
    }

    const markdown = convertHtmlFragmentToMarkdown(contents);

    if (markdown.length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_HTML_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown,
      warnings: [],
      status: "success"
    };
  } catch {
    return {
      markdown: "",
      warnings: ["This HTML file could not be read."],
      status: "error"
    };
  }
};

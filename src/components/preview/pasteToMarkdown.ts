import { convertHtmlFragmentToMarkdown } from "../../converters/richText";
import {
  convertLinkedInUnicodeInMarkdown,
  convertLinkedInUnicodeToMarkdown,
} from "./linkedInUnicode";
import {
  normalizePasteHtmlForMarkdown,
  restorePasteMarkdownPlaceholders,
} from "./pasteHtmlNormalizer";

type PasteSource = "html" | "plainText" | "empty";

export interface ClipboardPasteInput {
  html: string;
  plainText: string;
}

export interface ClipboardPasteConversion {
  markdown: string;
  source: PasteSource;
}

export { convertLinkedInUnicodeToMarkdown } from "./linkedInUnicode";

export function convertClipboardPasteToMarkdown({
  html,
  plainText,
}: ClipboardPasteInput): ClipboardPasteConversion {
  if (html.trim().length > 0) {
    const htmlMarkdown = restorePasteMarkdownPlaceholders(
      convertHtmlFragmentToMarkdown(normalizePasteHtmlForMarkdown(html)),
    );

    if (htmlMarkdown.trim().length > 0) {
      return {
        markdown: convertLinkedInUnicodeInMarkdown(htmlMarkdown),
        source: "html",
      };
    }
  }

  if (plainText.length === 0) {
    return {
      markdown: "",
      source: "empty",
    };
  }

  return {
    markdown: convertLinkedInUnicodeToMarkdown(plainText),
    source: "plainText",
  };
}

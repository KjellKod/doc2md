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

function restorePlainTextHorizontalRuleMarkers(
  markdown: string,
  plainText: string,
) {
  const plainLines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  let plainLineIndex = 0;

  return markdown
    .split("\n")
    .map((line) => {
      if (line.trim().length === 0) return line;

      const plainLine = plainLines[plainLineIndex];
      plainLineIndex += 1;

      if (
        (plainLine === "---" || plainLine === "—") &&
        (line.trim() === "—" || line.trim() === "\\—")
      ) {
        return `${line.match(/^\s*/)?.[0] ?? ""}\\---`;
      }

      return line;
    })
    .join("\n");
}

export function convertClipboardPasteToMarkdown({
  html,
  plainText,
}: ClipboardPasteInput): ClipboardPasteConversion {
  if (html.trim().length > 0) {
    const htmlMarkdown = restorePlainTextHorizontalRuleMarkers(
      restorePasteMarkdownPlaceholders(
        convertHtmlFragmentToMarkdown(normalizePasteHtmlForMarkdown(html), {
          inferGoogleDocsListNesting: false,
        }),
      ),
      plainText,
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

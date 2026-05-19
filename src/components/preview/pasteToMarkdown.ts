import { getDomParser } from "../../converters/runtime";
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

const BOLD_FONT_WEIGHT_THRESHOLD = 600;

// Tags whose presence means the HTML carries structural or semantic
// meaning that Turndown should preserve. If a paste's HTML contains
// none of these AND its visible text matches the plain-text payload,
// the HTML is just a transport wrapper (Gmail, Slack, "remove
// formatting" exports) around what is really plain text.
const MEANINGFUL_HTML_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "tr",
  "td",
  "th",
  "img",
  "hr",
  "sub",
  "sup",
  "mark",
  "del",
  "ins",
  "kbd",
  "samp",
  "var",
] as const;

const MEANINGFUL_HTML_SELECTOR = [
  ...MEANINGFUL_HTML_TAGS,
  "a[href]",
].join(",");

function inlineStyleEncodesEmphasis(element: Element): boolean {
  const style = element.getAttribute("style");
  if (!style) return false;

  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim().toLowerCase();
    if (!property || !value) continue;

    if (property === "font-weight") {
      if (value === "bold" || value === "bolder") return true;
      const numeric = Number.parseFloat(value);
      if (Number.isFinite(numeric) && numeric >= BOLD_FONT_WEIGHT_THRESHOLD) {
        return true;
      }
    }

    if (property === "font-style" && value === "italic") return true;
  }

  return false;
}

function htmlBodyHasMeaningfulFormatting(body: HTMLElement): boolean {
  if (body.querySelector(MEANINGFUL_HTML_SELECTOR)) return true;

  const styled = Array.from(body.querySelectorAll<HTMLElement>("[style]"));
  return styled.some(inlineStyleEncodesEmphasis);
}

// Regexes that each match a distinct markdown construct. Two or more
// hits across different patterns indicates the plain-text payload is
// already markdown, which means any extraneous HTML formatting (Gmail
// signature `<img>` and styled name, mail-tracking pixel, copy footer)
// should NOT pull us into Turndown's escape-everything path.
const MARKDOWN_SIGNAL_PATTERNS: readonly RegExp[] = [
  /^#{1,6}\s+\S/m, // ATX heading
  /^```/m, // fenced code block opener
  /\[[^\]\n]+\]\([^\s)]+\)/, // markdown link [label](url)
  /(\*\*|__)[^\s*_][^*_\n]*[^\s*_]\1/, // bold with **/__
  /(?:^|\s)`[^`\n]+`/, // inline code
  /^[-*+] \S.*\n[-*+] \S/m, // two consecutive bullet items
  /^\d+\.\s\S.*\n\d+\.\s\S/m, // two consecutive ordered items
  /^---+\s*$/m, // horizontal rule line
  /^>\s/m, // blockquote
];

function plainTextHasStrongMarkdownSignals(plainText: string): boolean {
  let hits = 0;
  for (const pattern of MARKDOWN_SIGNAL_PATTERNS) {
    if (pattern.test(plainText)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function reduceForWrapperComparison(text: string): string {
  // textContent across browsers does not insert whitespace at block
  // boundaries (e.g. `<div>a</div><div>b</div>` yields `"ab"`), while
  // the plain-text clipboard payload puts a newline between them.
  // Comparing whitespace-collapsed character bags decouples structural
  // shape from visible content: if every non-whitespace character
  // matches, the HTML is carrying the same content as plain text and
  // the linebreak shape difference is just transport.
  //
  // \s already covers nbsp (U+00A0); zero-width space (U+200B) and
  // zero-width no-break space / BOM (U+FEFF) do not, so strip them
  // explicitly.
  return text.replace(/[\s\u200B\uFEFF]+/g, "");
}

// Returns true when `html` carries no structural meaning beyond
// wrapping `plainText` (typical of Gmail / "remove formatting" copies
// where every visible line becomes a <div>line</div> and the source
// itself is already markdown). Routing these through Turndown corrupts
// markdown punctuation in text nodes via aggressive escaping
// (e.g. `# Heading` -> `\# Heading`, `**bold**` -> `\*\*bold\*\*`).
export function htmlIsTrivialPasteWrapper(
  html: string,
  plainText: string,
): boolean {
  if (html.trim().length === 0) return false;
  if (plainText.trim().length === 0) return false;

  let body: HTMLElement | null;
  try {
    const DOMParserCtor = getDomParser();
    const parser = new DOMParserCtor();
    body = parser.parseFromString(html, "text/html").body;
  } catch {
    return false;
  }

  if (!body) return false;

  const htmlReduced = reduceForWrapperComparison(body.textContent ?? "");
  const plainReduced = reduceForWrapperComparison(plainText);
  if (plainReduced.length === 0) return false;
  if (htmlReduced !== plainReduced) return false;

  if (!htmlBodyHasMeaningfulFormatting(body)) return true;

  // The HTML has some formatting but its visible text matches plain
  // text exactly. If plain text itself already contains multiple
  // markdown markers, the user copied markdown that picked up
  // extraneous HTML along the way (most commonly a Gmail signature
  // with a profile image and styled name). Honor the plain-text
  // version instead of escaping every markdown character through
  // Turndown.
  return plainTextHasStrongMarkdownSignals(plainText);
}

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
  if (
    html.trim().length > 0 &&
    !htmlIsTrivialPasteWrapper(html, plainText)
  ) {
    const htmlMarkdown = restorePlainTextHorizontalRuleMarkers(
      restorePasteMarkdownPlaceholders(
        convertHtmlFragmentToMarkdown(normalizePasteHtmlForMarkdown(html), {
          maxGoogleDocsInferredListDepth: 1,
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

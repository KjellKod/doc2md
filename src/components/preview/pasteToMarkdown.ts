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
import { convertTableCellCheckboxes } from "./tableCheckbox";

type PasteSource = "html" | "plainText" | "empty";

const BOLD_FONT_WEIGHT_THRESHOLD = 600;
const INCOMPLETE_HTML_FALLBACK_MIN_LENGTH_DELTA = 80;
const INCOMPLETE_HTML_FALLBACK_MAX_RATIO = 0.8;

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
  "code",
  "blockquote",
  "hr",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
] as const;

const MEANINGFUL_HTML_SELECTOR = [
  ...MEANINGFUL_HTML_TAGS,
  "a[href]",
].join(",");

// Only inline-style properties that markdown can actually represent count
// as "meaningful" rich formatting. `color`, `background`, and `font-size`
// produce no markdown markup (Turndown drops them), so treating them as
// meaningful served no purpose except to defeat the trivial-wrapper
// heuristic — routing styled-span-wrapped markdown (common on mobile
// clipboards) through Turndown, which then escapes every markdown
// character in the text nodes (`- ` -> `\- `, `**` -> `\*\*`).
const MEANINGFUL_INLINE_STYLE_KEYS = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
]);
const VISIBLE_TEXT_BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

function normalizeTextForPasteRouting(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVisibleTextFromHtmlNode(node: Node, parts: string[]): void {
  if (node.nodeType === node.TEXT_NODE) {
    parts.push(node.textContent ?? "");
    return;
  }

  if (node.nodeType !== node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const isBlock = VISIBLE_TEXT_BLOCK_TAGS.has(tagName);

  if (tagName === "br") {
    parts.push("\n");
    return;
  }

  if (isBlock && parts.length > 0) {
    parts.push("\n");
  }

  for (const child of Array.from(element.childNodes)) {
    extractVisibleTextFromHtmlNode(child, parts);
  }

  if (isBlock) {
    parts.push("\n");
  }
}

function extractNormalizedHtmlVisibleTextFromBody(body: HTMLElement): string {
  const parts: string[] = [];
  extractVisibleTextFromHtmlNode(body, parts);
  return normalizeTextForPasteRouting(parts.join(""));
}

function htmlIsClearlyIncompleteComparedToPlainText(
  html: string,
  plainText: string,
): boolean {
  const normalizedPlainText = normalizeTextForPasteRouting(plainText);
  if (normalizedPlainText.length === 0) return false;

  let normalizedHtmlText: string;
  try {
    const DOMParserCtor = getDomParser();
    const parser = new DOMParserCtor();
    const body = parser.parseFromString(html, "text/html").body;
    if (!body) return false;
    normalizedHtmlText = extractNormalizedHtmlVisibleTextFromBody(body);
  } catch {
    return false;
  }

  if (normalizedHtmlText.length === 0) return true;

  if (
    normalizedPlainText.includes(normalizedHtmlText) &&
    normalizedPlainText !== normalizedHtmlText
  ) {
    return true;
  }

  const lengthDelta = normalizedPlainText.length - normalizedHtmlText.length;
  if (lengthDelta < INCOMPLETE_HTML_FALLBACK_MIN_LENGTH_DELTA) return false;

  return (
    normalizedHtmlText.length / normalizedPlainText.length <=
    INCOMPLETE_HTML_FALLBACK_MAX_RATIO
  );
}

function inlineStyleHasMeaningfulFormatting(element: Element): boolean {
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
      // Anything below the bold threshold (e.g. the ubiquitous
      // `font-weight:400` mobile clipboards attach to plain text) is NOT
      // emphasis. Do not fall through to the generic meaningful-style
      // check, which would misread it as rich formatting.
      continue;
    }

    if (property === "font-style" && value === "italic") return true;

    if (
      MEANINGFUL_INLINE_STYLE_KEYS.has(property) &&
      value !== "normal" &&
      value !== "none"
    ) {
      return true;
    }
  }

  return false;
}

function htmlBodyHasMeaningfulFormatting(body: HTMLElement): boolean {
  if (body.querySelector(MEANINGFUL_HTML_SELECTOR)) return true;

  const styled = Array.from(body.querySelectorAll<HTMLElement>("[style]"));
  return styled.some(inlineStyleHasMeaningfulFormatting);
}

// Regexes that each match a distinct markdown construct. Two or more
// hits across different patterns indicates the plain-text payload is
// already markdown and can win only when the HTML is a true trivial
// wrapper with no meaningful rich markers.
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

  const normalizedHtmlText = extractNormalizedHtmlVisibleTextFromBody(body);
  const normalizedPlainText = normalizeTextForPasteRouting(plainText);
  if (normalizedPlainText.length === 0) return false;
  if (normalizedHtmlText !== normalizedPlainText) return false;
  if (htmlBodyHasMeaningfulFormatting(body)) return false;
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

      if (plainLine === "---" && (line.trim() === "—" || line.trim() === "\\—")) {
        return `${line.match(/^\s*/)?.[0] ?? ""}\\---`;
      }

      return line;
    })
    .join("\n");
}

function pasteConversion(
  markdown: string,
  source: PasteSource,
): ClipboardPasteConversion {
  // Checkbox markers inside table cells never render as checkboxes, so the
  // last step before the Markdown lands in the editor turns them into glyphs.
  return { markdown: convertTableCellCheckboxes(markdown), source };
}

export function convertClipboardPasteToMarkdown({
  html,
  plainText,
}: ClipboardPasteInput): ClipboardPasteConversion {
  if (html.trim().length > 0) {
    if (htmlIsClearlyIncompleteComparedToPlainText(html, plainText)) {
      return pasteConversion(
        convertLinkedInUnicodeToMarkdown(plainText),
        "plainText",
      );
    }

    if (htmlIsTrivialPasteWrapper(html, plainText)) {
      return pasteConversion(
        convertLinkedInUnicodeToMarkdown(plainText),
        "plainText",
      );
    }

    const htmlMarkdown = restorePlainTextHorizontalRuleMarkers(
      restorePasteMarkdownPlaceholders(
        convertHtmlFragmentToMarkdown(normalizePasteHtmlForMarkdown(html), {
          maxGoogleDocsInferredListDepth: 1,
        }),
      ),
      plainText,
    );

    if (htmlMarkdown.trim().length > 0) {
      return pasteConversion(
        convertLinkedInUnicodeInMarkdown(htmlMarkdown),
        "html",
      );
    }
  }

  if (plainText.length === 0) {
    return { markdown: "", source: "empty" };
  }

  return pasteConversion(
    convertLinkedInUnicodeToMarkdown(plainText),
    "plainText",
  );
}

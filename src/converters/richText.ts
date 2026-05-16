import TurndownService from "turndown";
import { renderMarkdownTable } from "./delimited";
import { getDomParser } from "./runtime";

const TABLE_PLACEHOLDER_PREFIX = "DOC2MDTABLE";

const GDOCS_LIST_FAMILY_PATTERN = /(?:^|\s)lst-kix_[^\s-]+-(\d+)(?:\s|$)/;
const GDOCS_LIST_ITEM_BULLET_PATTERN = /(?:^|\s)li-bullet-(\d+)(?:\s|$)/;
const GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE = "data-doc2md-list-level";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-"
});

turndownService.addRule("googleDocsListItem", {
  filter: (node) => {
    if (node.nodeName !== "LI") return false;
    const element = node as unknown as Element;
    return (
      typeof element.hasAttribute === "function" &&
      element.hasAttribute(GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE)
    );
  },
  replacement: (content, node, options) => {
    const element = node as unknown as Element;
    const parent = element.parentNode as Element | null;

    let prefix = options.bulletListMarker + "   ";
    if (parent && parent.nodeName === "OL") {
      const start = parent.getAttribute("start");
      const index = Array.prototype.indexOf.call(parent.children, element);
      prefix = (start ? Number(start) + index : index + 1) + ".  ";
    }

    const isParagraph = /\n$/.test(content);
    let normalized = content.replace(/^\n+/, "").replace(/\n+$/, "");
    if (isParagraph) normalized += "\n";
    normalized = normalized.replace(
      /\n/gm,
      "\n" + " ".repeat(prefix.length)
    );

    const rawLevel = Number.parseInt(
      element.getAttribute(GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE) ?? "0",
      10
    );
    const level = Number.isFinite(rawLevel) ? Math.max(0, rawLevel) : 0;
    const indent = "    ".repeat(level);

    return (
      indent + prefix + normalized + (element.nextSibling ? "\n" : "")
    );
  }
});

function normalizeCellText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function convertTable(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        normalizeCellText(cell.textContent ?? "")
      )
    )
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rows.length === 0) {
    return "";
  }

  return renderMarkdownTable(rows);
}

function replaceTablesWithPlaceholders(document: Document) {
  const replacements = new Map<string, string>();
  const tables = Array.from(document.querySelectorAll("table"));

  tables.forEach((table, index) => {
    const placeholder = `${TABLE_PLACEHOLDER_PREFIX}${index}`;
    const markdown = convertTable(table);
    const marker = document.createElement("div");

    marker.textContent = placeholder;
    table.replaceWith(marker);
    replacements.set(placeholder, markdown);
  });

  return replacements;
}

function collapseBlankLinesBetweenListItems(markdown: string): string {
  // After Turndown emits sibling <ul>/<ol> blocks it leaves a blank line
  // between them (`\n\n`). Adjacent list items that share a Google Docs
  // origin should remain a single visual list with no break.
  const listLine = /^(?: {4})*(?:[-*+]|\d+\.)\s/;
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    result.push(line);
    if (!listLine.test(line)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j += 1;
    if (j > i + 1 && j < lines.length && listLine.test(lines[j])) {
      i = j;
      continue;
    }

    i += 1;
  }

  return result.join("\n");
}

function restoreTablePlaceholders(markdown: string, replacements: Map<string, string>) {
  // Collapse excess whitespace between a bullet marker and its text, while
  // preserving leading indentation that encodes nesting level.
  let result = markdown.replace(/^(\s*[-*])\s{2,}/gm, "$1 ");
  result = collapseBlankLinesBetweenListItems(result);

  replacements.forEach((tableMarkdown, placeholder) => {
    result = result.replace(placeholder, tableMarkdown);
  });

  return result.trim();
}

interface ConvertHtmlFragmentToMarkdownOptions {
  inferGoogleDocsListNesting?: boolean;
  maxGoogleDocsInferredListDepth?: number;
}

function clampGoogleDocsListLevel(
  level: number,
  maxDepth: number | undefined
) {
  if (maxDepth === undefined) return Math.max(0, level);
  return Math.max(0, Math.min(level, maxDepth));
}

function levelFromUlClass(list: Element): number | null {
  const className = list.getAttribute("class") ?? "";
  const match = className.match(GDOCS_LIST_FAMILY_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

function levelFromLiClass(item: Element): number | null {
  const className = item.getAttribute("class") ?? "";
  const match = className.match(GDOCS_LIST_ITEM_BULLET_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

function levelFromAriaLevel(item: Element): number | null {
  const aria = item.getAttribute("aria-level");
  if (aria === null) return null;
  const parsed = Number.parseInt(aria, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed - 1) : null;
}

function levelFromExistingAnnotation(item: Element): number | null {
  const existing = item.getAttribute(GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE);
  if (existing === null) return null;
  const parsed = Number.parseInt(existing, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function determineGoogleDocsListItemLevel(item: Element): number | null {
  const annotated = levelFromExistingAnnotation(item);
  if (annotated !== null) return annotated;

  // Real Google Docs HTML carries the nesting level on the parent
  // <ul class="lst-kix_*-N">. `li-bullet-N` is the bullet *style* index
  // (almost always 0) and lies about depth, so prefer the parent class.
  const parent = item.parentElement;
  if (parent && (parent.tagName === "UL" || parent.tagName === "OL")) {
    const ulLevel = levelFromUlClass(parent);
    if (ulLevel !== null) return ulLevel;
  }

  const liLevel = levelFromLiClass(item);
  if (liLevel !== null) return liLevel;

  const ariaLevel = levelFromAriaLevel(item);
  if (ariaLevel !== null) return ariaLevel;

  return null;
}

/**
 * Annotate every <li> in the document with its absolute Google Docs list
 * level (clamped to `maxGoogleDocsInferredListDepth`). Annotation is the
 * only signal the listItem Turndown rule needs to emit the right indent.
 *
 * No DOM nodes are moved. Source order is preserved — even when Google
 * Docs batches an entire level into a single sibling <ul>, every item is
 * emitted at the position it occupies in the source HTML.
 */
function annotateGoogleDocsListLevels(
  document: Document,
  options: ConvertHtmlFragmentToMarkdownOptions
): void {
  const items = Array.from(document.querySelectorAll("li"));

  items.forEach((item) => {
    const rawLevel = determineGoogleDocsListItemLevel(item);
    if (rawLevel === null) return;

    const level = clampGoogleDocsListLevel(
      rawLevel,
      options.maxGoogleDocsInferredListDepth
    );
    item.setAttribute(GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE, String(level));
  });
}

export function convertHtmlFragmentToMarkdown(
  html: string,
  options: ConvertHtmlFragmentToMarkdownOptions = {}
) {
  const DOMParserCtor = getDomParser();
  const parser = new DOMParserCtor();
  const document = parser.parseFromString(html, "text/html");
  if (options.inferGoogleDocsListNesting ?? true) {
    annotateGoogleDocsListLevels(document, options);
  }
  const replacements = replaceTablesWithPlaceholders(document);

  return restoreTablePlaceholders(
    turndownService.turndown(document.body.innerHTML),
    replacements
  );
}

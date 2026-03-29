import TurndownService from "turndown";
import { renderMarkdownTable } from "./delimited";

const TABLE_PLACEHOLDER_PREFIX = "DOC2MDTABLE";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-"
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

function restoreTablePlaceholders(markdown: string, replacements: Map<string, string>) {
  // Collapse excess whitespace between a bullet marker and its text, while
  // preserving leading indentation that encodes nesting level.
  let result = markdown.replace(/^(\s*[-*])\s{2,}/gm, "$1 ");

  replacements.forEach((tableMarkdown, placeholder) => {
    result = result.replace(placeholder, tableMarkdown);
  });

  return result.trim();
}

const GDOCS_LIST_LEVEL_PATTERN = /lst-kix_\w+-(\d+)/;

/**
 * Google Docs exports nested lists as flat sibling <ul> elements with
 * CSS classes encoding the nesting level (e.g. lst-kix_xxx-0, lst-kix_xxx-1).
 * Turndown treats these as independent flat lists. This function restructures
 * consecutive sibling lists into proper nested HTML so Turndown produces
 * indented markdown.
 */
function nestGoogleDocsLists(doc: Document): void {
  const lists = Array.from(doc.querySelectorAll("ul, ol"));

  for (let i = lists.length - 1; i >= 0; i--) {
    const list = lists[i];
    const match = list.className.match(GDOCS_LIST_LEVEL_PATTERN);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    if (level === 0) continue;

    // Walk backwards through preceding siblings to find a list at a lower level
    let sibling = list.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === "UL" || sibling.tagName === "OL") {
        const sibMatch = sibling.className.match(GDOCS_LIST_LEVEL_PATTERN);
        if (sibMatch) {
          const sibLevel = parseInt(sibMatch[1], 10);
          if (sibLevel < level) {
            // Nest inside the last <li> of the preceding lower-level list
            const lastLi = sibling.querySelector("li:last-child");
            if (lastLi) {
              lastLi.appendChild(list);
            }
            break;
          }
        }
      }
      sibling = sibling.previousElementSibling;
    }
  }
}

export function convertHtmlFragmentToMarkdown(html: string) {
  const parser = new globalThis.DOMParser();
  const document = parser.parseFromString(html, "text/html");
  nestGoogleDocsLists(document);
  const replacements = replaceTablesWithPlaceholders(document);

  return restoreTablePlaceholders(
    turndownService.turndown(document.body.innerHTML),
    replacements
  );
}

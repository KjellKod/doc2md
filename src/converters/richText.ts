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
  let result = markdown.replace(/^(\s*[-*])\s{2,}/gm, "$1 ");

  replacements.forEach((tableMarkdown, placeholder) => {
    result = result.replace(placeholder, tableMarkdown);
  });

  return result.trim();
}

export function convertHtmlFragmentToMarkdown(html: string) {
  const parser = new globalThis.DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const replacements = replaceTablesWithPlaceholders(document);

  return restoreTablePlaceholders(
    turndownService.turndown(document.body.innerHTML),
    replacements
  );
}

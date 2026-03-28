import TurndownService from "turndown";
import { renderMarkdownTable } from "./delimited";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

const EMPTY_HTML_MESSAGE = "This HTML file is empty.";
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

    const parser = new globalThis.DOMParser();
    const document = parser.parseFromString(contents, "text/html");
    const replacements = replaceTablesWithPlaceholders(document);
    const markdown = restoreTablePlaceholders(
      turndownService.turndown(document.body.innerHTML),
      replacements
    );

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

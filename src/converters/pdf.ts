import {
  GlobalWorkerOptions,
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  TextItem,
  TextMarkedContent
} from "pdfjs-dist/types/src/display/api";
import {
  CORRUPT_FILE_MESSAGE,
  LOW_QUALITY_PDF_MESSAGE,
  SCANNED_PDF_MESSAGE
} from "./messages";
import { readFileAsArrayBuffer } from "./readBinary";
import type { Converter } from "./types";

export const PDF_LOW_TEXT_MESSAGE = SCANNED_PDF_MESSAGE;
export const PDF_LAYOUT_WARNING_MESSAGE = LOW_QUALITY_PDF_MESSAGE;
const LOW_TEXT_CHARACTER_THRESHOLD = 50;
const IMPERFECT_LAYOUT_CHARACTER_THRESHOLD = 140;
const LINE_BREAK_THRESHOLD = 4;
const PROCESS_INFO = typeof process === "object" && process !== null
  ? (process as NodeJS.Process & { type?: string })
  : null;
const IS_NODE_LIKE =
  PROCESS_INFO !== null &&
  `${PROCESS_INFO}` === "[object process]" &&
  !PROCESS_INFO.versions?.nw &&
  !(PROCESS_INFO.versions?.electron && PROCESS_INFO.type !== "browser");

if (!IS_NODE_LIKE) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item;
}

function normalizeTextValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shouldInsertSpace(currentLine: string, value: string) {
  if (currentLine.length === 0) {
    return false;
  }

  if (/[\s([{/"'`-]$/.test(currentLine)) {
    return false;
  }

  if (/^[,.;:!?%)}\]'"`]/.test(value)) {
    return false;
  }

  return true;
}

function flushLine(lines: string[], currentLine: string) {
  const normalizedLine = currentLine.trim();

  if (normalizedLine.length > 0) {
    lines.push(normalizedLine);
  }
}

export function renderPdfPageText(items: Array<TextItem | TextMarkedContent>) {
  const lines: string[] = [];
  let currentLine = "";
  let previousY: number | null = null;

  for (const item of items) {
    if (!isTextItem(item)) {
      continue;
    }

    const value = normalizeTextValue(item.str);

    if (value.length === 0) {
      if (item.hasEOL) {
        flushLine(lines, currentLine);
        currentLine = "";
        previousY = null;
      }
      continue;
    }

    const currentY = Math.round(item.transform[5]);
    const isNewLine =
      previousY !== null && Math.abs(currentY - previousY) > LINE_BREAK_THRESHOLD;

    if (isNewLine) {
      flushLine(lines, currentLine);
      currentLine = "";
    }

    currentLine += `${shouldInsertSpace(currentLine, value) ? " " : ""}${value}`;
    previousY = currentY;

    if (item.hasEOL) {
      flushLine(lines, currentLine);
      currentLine = "";
      previousY = null;
    }
  }

  flushLine(lines, currentLine);

  return lines.join("\n").trim();
}

function countMeaningfulCharacters(value: string) {
  return value.replace(/\s+/g, "").length;
}

export function classifyPdfQuality(pageTexts: string[]) {
  const nonEmptyPages = pageTexts.filter((pageText) => pageText.trim().length > 0);
  const totalCharacters = pageTexts.reduce(
    (sum, pageText) => sum + countMeaningfulCharacters(pageText),
    0
  );
  const totalPages = Math.max(pageTexts.length, 1);
  const averageCharactersPerPage = totalCharacters / totalPages;
  const allLines = nonEmptyPages.flatMap((pageText) =>
    pageText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
  const averageCharactersPerLine =
    totalCharacters / Math.max(allLines.length, 1);
  const shortLineRatio =
    allLines.length === 0
      ? 0
      : allLines.filter((line) => line.length < 24).length / allLines.length;

  if (totalCharacters === 0 || averageCharactersPerPage < LOW_TEXT_CHARACTER_THRESHOLD) {
    return {
      status: "error" as const,
      warnings: [PDF_LOW_TEXT_MESSAGE]
    };
  }

  if (
    averageCharactersPerPage < IMPERFECT_LAYOUT_CHARACTER_THRESHOLD ||
    averageCharactersPerLine < 24 ||
    shortLineRatio > 0.75
  ) {
    return {
      status: "warning" as const,
      warnings: [PDF_LAYOUT_WARNING_MESSAGE]
    };
  }

  return {
    status: "success" as const,
    warnings: []
  };
}

export const convertPdf: Converter = async (file) => {
  let loadingTask:
    | ReturnType<typeof getDocument>
    | undefined;

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);

    loadingTask = getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });

    const document = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();

      pageTexts.push(renderPdfPageText(textContent.items));
    }

    const markdown = pageTexts
      .map((pageText, index) => `## Page ${index + 1}\n\n${pageText || "_No extractable text found on this page._"}`)
      .join("\n\n");
    const quality = classifyPdfQuality(pageTexts);

    if (quality.status === "error") {
      return {
        markdown: "",
        warnings: quality.warnings,
        status: "error"
      };
    }

    return {
      markdown,
      warnings: quality.warnings,
      status: quality.status
    };
  } catch {
    return {
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    };
  } finally {
    if (loadingTask && typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  }
};

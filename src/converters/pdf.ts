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
import type { ConversionQuality, Converter } from "./types";

export const PDF_LOW_TEXT_MESSAGE = SCANNED_PDF_MESSAGE;
export const PDF_LAYOUT_WARNING_MESSAGE = LOW_QUALITY_PDF_MESSAGE;
const LOW_TEXT_CHARACTER_THRESHOLD = 50;
const IMPERFECT_LAYOUT_CHARACTER_THRESHOLD = 140;
const LINE_BREAK_THRESHOLD = 4;
const PARAGRAPH_GAP_FACTOR = 1.8;
const BULLET_CHAR_PATTERN = /^[•➢▸▪◦○◆■●]/;
const DASH_BULLET_PATTERN = /^[-–—]\s/;
const SHORT_LINE_CHARACTER_THRESHOLD = 24;
const POOR_PDF_QUALITY_SUMMARY =
  "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.";
const UNREADABLE_PDF_QUALITY_SUMMARY =
  "Poor: Could not assess PDF quality because this PDF could not be read.";

const H1_SIZE_DELTA = 8;
const H2_SIZE_DELTA = 4;
const H3_SIZE_DELTA = 2;

const DATE_PATTERN =
  /^(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}(?:\s*[-–—]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}|present|current))?|\d{4}\s*[-–—]\s*(?:\d{4}|present|current)|(?:Finished entire project,?\s*)?(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}\s*[-–—]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{4}|present|current))\s*$/i;

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

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

function getFontSize(transform: [number, number, number, number, number, number]) {
  return Math.round(Math.hypot(transform[0], transform[1]));
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

interface FontProfile {
  bodyFontSize: number;
  bodyFontName: string;
  boldFontNames: Set<string>;
}

function detectFontProfile(allItems: Array<TextItem | TextMarkedContent>): FontProfile {
  const charCounts: Record<string, number> = {};

  for (const item of allItems) {
    if (!isTextItem(item)) continue;
    const text = item.str.trim();
    if (!text) continue;
    const fontSize = getFontSize(item.transform as [number, number, number, number, number, number]);
    const fontName = item.fontName || "unknown";
    const key = `${fontName}@${fontSize}`;
    charCounts[key] = (charCounts[key] || 0) + text.length;
  }

  const sorted = Object.entries(charCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { bodyFontSize: 10, bodyFontName: "unknown", boldFontNames: new Set() };
  }

  const [bodyKey] = sorted[0];
  const [bodyFontName, bodySizeStr] = bodyKey.split("@");
  const bodyFontSize = parseInt(bodySizeStr);

  const boldFontNames = new Set<string>();
  for (const key of Object.keys(charCounts)) {
    const [name, size] = key.split("@");
    if (parseInt(size) === bodyFontSize && name !== bodyFontName) {
      boldFontNames.add(name);
    }
  }

  return { bodyFontSize, bodyFontName, boldFontNames };
}

interface LineInfo {
  text: string;
  fontSize: number;
  fontName: string;
  isBullet: boolean;
}

function classifyLine(line: LineInfo, fontProfile: FontProfile): string {
  const { text, fontSize, fontName, isBullet } = line;
  const { bodyFontSize, boldFontNames } = fontProfile;
  const sizeDelta = fontSize - bodyFontSize;

  if (isBullet) {
    const cleaned = text.replace(BULLET_CHAR_PATTERN, "").replace(DASH_BULLET_PATTERN, "").trim();
    return `- ${cleaned}`;
  }

  if (sizeDelta >= H3_SIZE_DELTA) {
    if (DATE_PATTERN.test(text)) {
      return `**${text}**`;
    }
    if (URL_ONLY_PATTERN.test(text)) {
      return text;
    }

    if (sizeDelta >= H1_SIZE_DELTA) {
      return `# ${text}`;
    }
    if (sizeDelta >= H2_SIZE_DELTA) {
      return `## ${text}`;
    }
    return `### ${text}`;
  }

  if (boldFontNames.has(fontName) && text.length < 100) {
    return `**${text}**`;
  }

  return text;
}

export function renderPdfPageText(
  items: Array<TextItem | TextMarkedContent>,
  fontProfile?: FontProfile
) {
  const profile = fontProfile || detectFontProfile(items);
  const collectedLines: LineInfo[] = [];
  let currentText = "";
  let currentFontSize = 0;
  let currentFontName = "";
  let currentIsBullet = false;
  let previousY: number | null = null;
  let pendingParagraphBreak = false;

  function flushLine() {
    const trimmed = currentText.trim();
    if (trimmed.length > 0) {
      if (pendingParagraphBreak && collectedLines.length > 0) {
        collectedLines.push({ text: "", fontSize: 0, fontName: "", isBullet: false });
        pendingParagraphBreak = false;
      }
      const isBullet = currentIsBullet || DASH_BULLET_PATTERN.test(trimmed);
      collectedLines.push({
        text: trimmed,
        fontSize: currentFontSize,
        fontName: currentFontName,
        isBullet
      });
    }
    currentText = "";
    currentFontSize = 0;
    currentFontName = "";
    currentIsBullet = false;
  }

  for (const item of items) {
    if (!isTextItem(item)) {
      continue;
    }

    const value = normalizeTextValue(item.str);

    if (value.length === 0) {
      if (item.hasEOL) {
        flushLine();
        previousY = null;
      }
      continue;
    }

    const currentY = Math.round(item.transform[5]);
    const fontSize = getFontSize(item.transform as [number, number, number, number, number, number]);
    const fontName = item.fontName || "unknown";
    const isNewLine =
      previousY !== null && Math.abs(currentY - previousY) > LINE_BREAK_THRESHOLD;
    const isParagraphGap =
      previousY !== null &&
      Math.abs(currentY - previousY) > profile.bodyFontSize * PARAGRAPH_GAP_FACTOR;

    if (isNewLine) {
      flushLine();
      if (isParagraphGap) {
        pendingParagraphBreak = true;
      }
    }

    if (!currentText) {
      currentFontSize = fontSize;
      currentFontName = fontName;
      currentIsBullet = BULLET_CHAR_PATTERN.test(value);
    }

    currentText += `${shouldInsertSpace(currentText, value) ? " " : ""}${value}`;
    previousY = currentY;

    if (item.hasEOL) {
      flushLine();
      previousY = null;
    }
  }

  flushLine();

  const outputLines: string[] = [];
  for (const line of collectedLines) {
    if (line.text === "") {
      if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== "") {
        outputLines.push("");
      }
      continue;
    }

    const classified = classifyLine(line, profile);
    const isHeading = /^#{1,3} /.test(classified);

    if (isHeading && outputLines.length > 0 && outputLines[outputLines.length - 1] !== "") {
      outputLines.push("");
    }

    outputLines.push(classified);

    if (isHeading) {
      outputLines.push("");
    }
  }

  return mergeBulletContinuations(outputLines).join("\n").trim();
}

/**
 * Merge plain body continuation lines into the preceding bullet when:
 * - previous non-empty line starts with `- `
 * - previous line does NOT end with terminal punctuation
 * - current line looks like wrapped continuation text, not a new sentence/list item
 * - current line is not a heading, bullet, or bold text
 */
export function mergeBulletContinuations(lines: string[]): string[] {
  const result: string[] = [];

  for (const line of lines) {
    if (line === "" || result.length === 0) {
      result.push(line);
      continue;
    }

    // Find the last non-empty line in result
    let lastIdx = result.length - 1;
    while (lastIdx >= 0 && result[lastIdx] === "") {
      lastIdx--;
    }

    if (lastIdx < 0) {
      result.push(line);
      continue;
    }

    const prev = result[lastIdx];
    const isBulletContinuation =
      prev.startsWith("- ") &&
      !/[.!?:;]$/.test(prev) &&
      isBodyLine(line) &&
      startsLikeBulletContinuation(line) &&
      // Only merge if no blank lines separate them
      lastIdx === result.length - 1;

    if (isBulletContinuation) {
      result[lastIdx] = `${prev} ${line}`;
    } else {
      result.push(line);
    }
  }

  return result;
}

function startsLikeBulletContinuation(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.length === 0) return false;
  if (/^\d+[.)]\s/.test(trimmed)) return false;
  if (/^[A-Z]/.test(trimmed)) return false;

  return true;
}

function countMeaningfulCharacters(value: string) {
  return value.replace(/\s+/g, "").length;
}

export interface PdfQualitySignals {
  lowSelectableText: boolean;
  sparseText: boolean;
  fragmentedLines: boolean;
}

export interface PdfQualityAssessment {
  status: "error" | "warning" | "success";
  warnings: string[];
  quality: ConversionQuality;
  signals: PdfQualitySignals;
}

export function classifyPdfQuality(pageTexts: string[]): PdfQualityAssessment {
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
      : allLines.filter((line) => line.length < SHORT_LINE_CHARACTER_THRESHOLD).length / allLines.length;
  const lowSelectableText =
    totalCharacters === 0 || averageCharactersPerPage < LOW_TEXT_CHARACTER_THRESHOLD;
  const sparseText = averageCharactersPerPage < IMPERFECT_LAYOUT_CHARACTER_THRESHOLD;
  const fragmentedLines =
    averageCharactersPerLine < SHORT_LINE_CHARACTER_THRESHOLD || shortLineRatio > 0.75;

  if (lowSelectableText) {
    return {
      status: "error" as const,
      warnings: [PDF_LOW_TEXT_MESSAGE],
      quality: {
        level: "poor" as const,
        summary: POOR_PDF_QUALITY_SUMMARY
      },
      signals: {
        lowSelectableText,
        sparseText,
        fragmentedLines
      }
    };
  }

  if (sparseText || fragmentedLines) {
    return {
      status: "warning" as const,
      warnings: [PDF_LAYOUT_WARNING_MESSAGE],
      quality: {
        level: "review" as const,
        summary: "Review: Text was extracted, but layout may be fragmented or out of reading order."
      },
      signals: {
        lowSelectableText,
        sparseText,
        fragmentedLines
      }
    };
  }

  return {
    status: "success" as const,
    warnings: [],
    quality: {
      level: "good" as const,
      summary: "Good: Selectable text detected. Layout looks straightforward."
    },
    signals: {
      lowSelectableText,
      sparseText,
      fragmentedLines
    }
  };
}

function isBodyLine(line: string): boolean {
  if (line.length === 0) return false;
  if (line.startsWith("#")) return false;
  if (line.startsWith("- ")) return false;
  if (line.startsWith("**")) return false;
  return true;
}

function looksLikeContinuation(prevLine: string, nextLine: string): boolean {
  const trimmedPrev = prevLine.trim();
  const trimmedNext = nextLine.trim();
  if (!isBodyLine(trimmedPrev) || !isBodyLine(trimmedNext)) return false;
  if (/[.!?:;]$/.test(trimmedPrev)) return false;
  if (/^\d+[.)]\s/.test(trimmedNext)) return false;
  if (/^[A-Z][A-Z]/.test(trimmedNext)) return false;
  return true;
}

export function mergePageTexts(pageTexts: string[]): string {
  const nonEmpty = pageTexts.filter((t) => t.trim().length > 0);
  if (nonEmpty.length === 0) return "";

  const result: string[] = [];

  for (let i = 0; i < nonEmpty.length; i++) {
    const pageText = nonEmpty[i];

    if (i === 0) {
      result.push(pageText);
      continue;
    }

    const prevLines = result.join("\n").split("\n");
    const lastNonEmpty = [...prevLines].reverse().find((l) => l.trim().length > 0) || "";
    const firstLine = pageText.split("\n").find((l) => l.trim().length > 0) || "";

    if (looksLikeContinuation(lastNonEmpty, firstLine)) {
      const lines = pageText.split("\n");
      const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
      if (firstNonEmptyIdx >= 0) {
        const trailingNewlines = result.join("\n").replace(/\n+$/, "");
        const merged = `${trailingNewlines} ${lines[firstNonEmptyIdx].trim()}`;
        const rest = lines.slice(firstNonEmptyIdx + 1).join("\n");
        result.length = 0;
        result.push(merged);
        if (rest.trim().length > 0) {
          result.push(rest);
        }
      }
    } else {
      result.push("");
      result.push(pageText);
    }
  }

  return result.join("\n").trim();
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
    const allItems: Array<TextItem | TextMarkedContent> = [];
    const pageItemRanges: Array<{ start: number; end: number }> = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const start = allItems.length;
      allItems.push(...textContent.items);
      pageItemRanges.push({ start, end: allItems.length });
    }

    const fontProfile = detectFontProfile(allItems);
    const pageTexts: string[] = [];

    for (const { start, end } of pageItemRanges) {
      const pageItems = allItems.slice(start, end);
      pageTexts.push(renderPdfPageText(pageItems, fontProfile));
    }

    const markdown = mergePageTexts(pageTexts);
    const quality = classifyPdfQuality(pageTexts);

    if (quality.status === "error") {
      return {
        markdown: "",
        warnings: quality.warnings,
        status: "error",
        quality: quality.quality
      };
    }

    return {
      markdown,
      warnings: quality.warnings,
      status: quality.status,
      quality: quality.quality
    };
  } catch {
    return {
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error",
      quality: {
        level: "poor",
        summary: UNREADABLE_PDF_QUALITY_SUMMARY
      }
    };
  } finally {
    if (loadingTask && typeof loadingTask.destroy === "function") {
      void loadingTask.destroy().catch(() => {
        // Cleanup should not block or change the user-visible conversion result.
      });
    }
  }
};

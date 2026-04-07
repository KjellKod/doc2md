import {
  GlobalWorkerOptions,
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";
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
const KERNING_GAP_FACTOR = 0.3;
const SUPERSCRIPT_SYMBOL_PATTERN = /^[®™©°¹²³]+$/;
const HEADER_FOOTER_BAND_RATIO = 0.05;
const TABLE_COLUMN_TOLERANCE = 10;
const TABLE_HEADER_TOLERANCE = 20;
const TABLE_MIN_ROWS = 3;
const LIST_INDENT_STEP = 18;
const MARKDOWN_BULLET_PATTERN = /^\s*-\s/;
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

let browserWorkerConfigured = false;

async function ensureBrowserWorkerConfigured() {
  if (IS_NODE_LIKE || browserWorkerConfigured) {
    return;
  }

  const pdfWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  GlobalWorkerOptions.workerSrc = pdfWorker.default;
  browserWorkerConfigured = true;
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

function getItemX(item: TextItem) {
  return item.transform[4];
}

function getItemY(item: TextItem) {
  return item.transform[5];
}

function getItemWidth(item: TextItem) {
  if (typeof item.width === "number" && Number.isFinite(item.width) && item.width > 0) {
    return item.width;
  }

  const fontSize = getFontSize(item.transform as [number, number, number, number, number, number]);
  return Math.max(normalizeTextValue(item.str).length, 1) * Math.max(fontSize * 0.5, 1);
}

function getAverageCharacterWidth(item: TextItem) {
  return getItemWidth(item) / Math.max(normalizeTextValue(item.str).length, 1);
}

function isKerningGap(previousItem: TextItem, currentItem: TextItem) {
  const gap = getItemX(currentItem) - (getItemX(previousItem) + getItemWidth(previousItem));
  if (gap <= 0) {
    return true;
  }

  const averageCharacterWidth =
    (getAverageCharacterWidth(previousItem) + getAverageCharacterWidth(currentItem)) / 2;
  return gap < averageCharacterWidth * KERNING_GAP_FACTOR;
}

function shouldInsertSpace(
  currentLine: string,
  value: string,
  previousItem?: TextItem,
  currentItem?: TextItem
) {
  if (currentLine.length === 0) {
    return false;
  }

  if (/[\s([{/"'`-]$/.test(currentLine)) {
    return false;
  }

  if (/^[,.;:!?%)}\]'"`]/.test(value)) {
    return false;
  }

  if (previousItem && currentItem && isKerningGap(previousItem, currentItem)) {
    return false;
  }

  return true;
}

interface TextRow {
  y: number;
  items: TextItem[];
}

function groupItemsByRow(items: TextItem[]): TextRow[] {
  const rows: TextRow[] = [];
  const sortedItems = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const yDelta = getItemY(b.item) - getItemY(a.item);
      if (Math.abs(yDelta) > LINE_BREAK_THRESHOLD) {
        return yDelta;
      }

      return a.index - b.index;
    });

  const finalizeRow = (row: TextRow) => {
    row.items.sort((left, right) => getItemX(left) - getItemX(right));
    rows.push(row);
  };

  let currentRow: TextRow | null = null;

  for (const { item } of sortedItems) {
    const y = getItemY(item);

    if (!currentRow || Math.abs(currentRow.y - y) > LINE_BREAK_THRESHOLD) {
      if (currentRow) {
        finalizeRow(currentRow);
      }

      currentRow = { y, items: [] };
    }

    currentRow.items.push(item);

    if (item.hasEOL) {
      finalizeRow(currentRow);
      currentRow = null;
    }
  }

  if (currentRow) {
    finalizeRow(currentRow);
  }

  return rows.sort((a, b) => b.y - a.y);
}

function joinRowText(items: TextItem[]) {
  let line = "";
  let previousItem: TextItem | undefined;

  for (const item of items) {
    const value = normalizeTextValue(item.str);
    if (!value) {
      continue;
    }

    line += `${shouldInsertSpace(line, value, previousItem, item) ? " " : ""}${value}`;
    previousItem = item;
  }

  return line.trim();
}

function isSuperscriptSymbol(value: string) {
  return SUPERSCRIPT_SYMBOL_PATTERN.test(value);
}

function foldSuperscripts(items: TextItem[]) {
  const foldedItems: TextItem[] = [];

  for (const item of items) {
    const value = normalizeTextValue(item.str);
    if (!value) {
      foldedItems.push(item);
      continue;
    }

    const previousItem = foldedItems[foldedItems.length - 1];
    if (!previousItem) {
      foldedItems.push(item);
      continue;
    }

    const currentY = Math.round(getItemY(item));
    const previousY = Math.round(getItemY(previousItem));
    const previousFontSize = getFontSize(
      previousItem.transform as [number, number, number, number, number, number]
    );
    const currentFontSize = getFontSize(
      item.transform as [number, number, number, number, number, number]
    );

    if (
      Math.abs(currentY - previousY) <= LINE_BREAK_THRESHOLD &&
      currentFontSize < previousFontSize * 0.75 &&
      isSuperscriptSymbol(value)
    ) {
      foldedItems[foldedItems.length - 1] = {
        ...previousItem,
        str: `${previousItem.str}${value}`,
        width: getItemWidth(previousItem) + getItemWidth(item),
        hasEOL: previousItem.hasEOL || item.hasEOL
      };
      continue;
    }

    foldedItems.push(item);
  }

  return foldedItems;
}

function stripDotLeaders(line: string) {
  return line.replace(/\s+\.{3,}\s*\d*\s*$/, "").trimEnd();
}

function getEstimatedPageHeight(items: TextItem[]) {
  return items.reduce((maxY, item) => Math.max(maxY, getItemY(item)), 0);
}

function normalizeRepeatedPageText(value: string) {
  return normalizeTextValue(value).toLowerCase().replace(/\d+/g, "#");
}

function getHeaderFooterBand(y: number, pageHeight: number) {
  if (pageHeight <= 0) {
    return null;
  }

  if (y >= pageHeight * (1 - HEADER_FOOTER_BAND_RATIO)) {
    return "top";
  }

  if (y <= pageHeight * HEADER_FOOTER_BAND_RATIO) {
    return "bottom";
  }

  return null;
}

interface PdfPageText {
  items: TextItem[];
  height: number;
}

function detectHeaderFooterItems(pages: PdfPageText[]) {
  const repeatedCandidates = new Map<string, Set<number>>();

  for (const [pageIndex, page] of pages.entries()) {
    const { items, height: pageHeight } = page;
    const rows = groupItemsByRow(items);
    const pageKeys = new Set<string>();

    for (const row of rows) {
      const band = getHeaderFooterBand(row.y, pageHeight);
      if (!band) {
        continue;
      }

      const normalizedText = normalizeRepeatedPageText(joinRowText(row.items));
      if (!normalizedText) {
        continue;
      }

      const key = `${band}:${normalizedText}`;
      if (pageKeys.has(key)) {
        continue;
      }

      pageKeys.add(key);
      if (!repeatedCandidates.has(key)) {
        repeatedCandidates.set(key, new Set());
      }
      repeatedCandidates.get(key)?.add(pageIndex);
    }
  }

  return new Set(
    [...repeatedCandidates.entries()]
      .filter(([, pageIndexes]) => pageIndexes.size >= 3)
      .map(([key]) => key)
  );
}

function stripHeaderFooter(
  items: TextItem[],
  repeatedFingerprints: Set<string>,
  pageHeight = getEstimatedPageHeight(items)
) {
  if (repeatedFingerprints.size === 0) {
    return items;
  }

  const removableItems = new Set<TextItem>();

  for (const row of groupItemsByRow(items)) {
    const band = getHeaderFooterBand(row.y, pageHeight);
    if (!band) {
      continue;
    }

    const normalizedText = normalizeRepeatedPageText(joinRowText(row.items));
    if (!normalizedText) {
      continue;
    }

    if (repeatedFingerprints.has(`${band}:${normalizedText}`)) {
      for (const item of row.items) {
        removableItems.add(item);
      }
    }
  }

  return items.filter((item) => !removableItems.has(item));
}

function stripHeaderFooterForPage(page: PdfPageText, repeatedFingerprints: Set<string>) {
  if (repeatedFingerprints.size === 0) {
    return page.items;
  }

  return stripHeaderFooter(page.items, repeatedFingerprints, page.height);
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
  indentLevel: number;
  spans: Array<{ text: string; fontName: string }>;
}

interface TableRegion {
  startIndex: number;
  endIndex: number;
  columnXs: number[];
}

interface RowColumnCluster {
  x: number;
  maxX: number;
  items: TextItem[];
}

function isBulletItem(value: string, fontName: string, fontProfile: FontProfile) {
  return BULLET_CHAR_PATTERN.test(value) || (value === "o" && fontName !== fontProfile.bodyFontName);
}

function cleanBulletText(text: string) {
  return text
    .replace(BULLET_CHAR_PATTERN, "")
    .replace(DASH_BULLET_PATTERN, "")
    .replace(/^[oO](?:\s+|$)/, "")
    .trim();
}

function computeIndentLevel(itemX: number, baseX: number, stepSize = LIST_INDENT_STEP) {
  return Math.max(0, Math.round((itemX - baseX) / stepSize));
}

function detectBaseX(
  rows: TextRow[],
  fontProfile: FontProfile,
  tableRegions: TableRegion[] = []
) {
  const excludedRowIndexes = new Set<number>();
  for (const region of tableRegions) {
    for (let index = region.startIndex; index <= region.endIndex; index += 1) {
      excludedRowIndexes.add(index);
    }
  }
  const candidateRows =
    excludedRowIndexes.size > 0
      ? rows.filter((_, index) => !excludedRowIndexes.has(index))
      : rows;

  const rowsToMeasure = candidateRows.length > 0 ? candidateRows : rows;
  const buckets = new Map<number, number>();
  const fallbackXs: number[] = [];

  for (const row of rowsToMeasure) {
    const firstItem = row.items.find((item) => normalizeTextValue(item.str).length > 0);
    if (!firstItem) {
      continue;
    }

    const value = normalizeTextValue(firstItem.str);
    const x = getItemX(firstItem);
    fallbackXs.push(x);

    if (isBulletItem(value, firstItem.fontName || "unknown", fontProfile) || DASH_BULLET_PATTERN.test(value)) {
      continue;
    }

    const fontSize = getFontSize(
      firstItem.transform as [number, number, number, number, number, number]
    );
    if (Math.abs(fontSize - fontProfile.bodyFontSize) > 1) {
      continue;
    }

    const bucket = Math.round(x / 6) * 6;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  if (buckets.size === 0) {
    return fallbackXs.length > 0 ? Math.min(...fallbackXs) : 0;
  }

  return [...buckets.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}

function appendSpan(
  spans: Array<{ text: string; fontName: string }>,
  fontName: string,
  text: string
) {
  if (!text) {
    return;
  }

  const previousSpan = spans[spans.length - 1];
  if (previousSpan && previousSpan.fontName === fontName) {
    previousSpan.text += text;
    return;
  }

  spans.push({ text, fontName });
}

function formatBoldSegment(text: string) {
  const leadingWhitespace = text.match(/^\s*/)?.[0] || "";
  const trailingWhitespace = text.match(/\s*$/)?.[0] || "";
  const core = text.slice(leadingWhitespace.length, text.length - trailingWhitespace.length);

  if (!core) {
    return text;
  }

  return `${leadingWhitespace}**${core}**${trailingWhitespace}`;
}

function renderInlineBoldText(
  spans: Array<{ text: string; fontName: string }>,
  boldFontNames: Set<string>
) {
  const combinedText = spans.map((span) => span.text).join("");
  const trimmedText = combinedText.trim();
  const hasBoldSpan = spans.some(
    (span) => span.text.trim().length > 0 && boldFontNames.has(span.fontName)
  );
  const hasRegularSpan = spans.some(
    (span) => span.text.trim().length > 0 && !boldFontNames.has(span.fontName)
  );

  if (!hasBoldSpan) {
    return trimmedText;
  }

  if (!hasRegularSpan && trimmedText.length < 100) {
    return `**${trimmedText}**`;
  }

  return spans
    .map((span) => (boldFontNames.has(span.fontName) ? formatBoldSegment(span.text) : span.text))
    .join("")
    .trim();
}

function buildLineInfoFromRow(row: TextRow, fontProfile: FontProfile, baseX: number): LineInfo | null {
  let text = "";
  let fontName = "";
  let fontSize = 0;
  let isBullet = false;
  let previousItem: TextItem | undefined;
  let indentLevel = 0;
  const spans: Array<{ text: string; fontName: string }> = [];
  const firstItem = row.items.find((item) => normalizeTextValue(item.str).length > 0);

  if (!firstItem) {
    return null;
  }

  for (const item of row.items) {
    const value = normalizeTextValue(item.str);
    if (!value) {
      continue;
    }

    const currentFontName = item.fontName || "unknown";
    const currentFontSize = getFontSize(
      item.transform as [number, number, number, number, number, number]
    );
    const segment = `${shouldInsertSpace(text, value, previousItem, item) ? " " : ""}${value}`;

    if (!fontName) {
      fontName = currentFontName;
      isBullet =
        isBulletItem(value, currentFontName, fontProfile) || DASH_BULLET_PATTERN.test(value);
      if (isBullet) {
        indentLevel = computeIndentLevel(getItemX(item), baseX);
      }
    }

    fontSize = Math.max(fontSize, currentFontSize);
    text += segment;
    appendSpan(spans, currentFontName, segment);
    previousItem = item;
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }

  if (!isBullet && DASH_BULLET_PATTERN.test(trimmedText)) {
    isBullet = true;
    indentLevel = computeIndentLevel(getItemX(firstItem), baseX);
  }

  return {
    text: trimmedText,
    fontSize,
    fontName,
    isBullet,
    indentLevel,
    spans
  };
}

function getRowColumnClusters(row: TextRow, fontProfile: FontProfile) {
  const firstItem = row.items.find((item) => normalizeTextValue(item.str).length > 0);
  if (!firstItem) {
    return null;
  }

  const firstValue = normalizeTextValue(firstItem.str);
  if (
    isBulletItem(firstValue, firstItem.fontName || "unknown", fontProfile) ||
    DASH_BULLET_PATTERN.test(firstValue)
  ) {
    return null;
  }

  const positions = row.items
    .map((item) => ({
      item,
      x: getItemX(item),
      value: normalizeTextValue(item.str)
    }))
    .filter(({ value }) => value.length > 0)
    .sort((a, b) => a.x - b.x);

  if (positions.length < 2) {
    return null;
  }

  const clusters: RowColumnCluster[] = [];
  for (const position of positions) {
    const previousCluster = clusters[clusters.length - 1];
    if (
      previousCluster &&
      position.x - previousCluster.maxX <= TABLE_COLUMN_TOLERANCE
    ) {
      previousCluster.maxX = position.x;
      previousCluster.items.push(position.item);
      continue;
    }

    clusters.push({
      x: position.x,
      maxX: position.x,
      items: [position.item]
    });
  }

  if (clusters.length < 2) {
    return null;
  }

  return clusters;
}

function getRowColumnXs(row: TextRow, fontProfile: FontProfile) {
  return getRowColumnClusters(row, fontProfile)?.map((cluster) => cluster.x) ?? null;
}

function rowMatchesColumns(row: TextRow, columnXs: number[], fontProfile: FontProfile, tolerance: number) {
  const rowColumns = getRowColumnXs(row, fontProfile);
  if (!rowColumns || rowColumns.length !== columnXs.length) {
    return false;
  }

  return rowColumns.every((columnX, index) => Math.abs(columnX - columnXs[index]) <= tolerance);
}

function detectTableRegions(rows: TextRow[], fontProfile: FontProfile) {
  const regions: TableRegion[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const columnXs = getRowColumnXs(rows[index], fontProfile);
    if (!columnXs || columnXs.length < 2) {
      continue;
    }

    let endIndex = index;
    while (
      endIndex + 1 < rows.length &&
      rowMatchesColumns(rows[endIndex + 1], columnXs, fontProfile, TABLE_COLUMN_TOLERANCE)
    ) {
      endIndex += 1;
    }

    const dataRowCount = endIndex - index + 1;
    if (dataRowCount < TABLE_MIN_ROWS) {
      continue;
    }

    let startIndex = index;
    if (
      index > 0 &&
      rowMatchesColumns(rows[index - 1], columnXs, fontProfile, TABLE_HEADER_TOLERANCE)
    ) {
      startIndex = index - 1;
    }

    regions.push({ startIndex, endIndex, columnXs });
    index = endIndex;
  }

  return regions;
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function renderMarkdownTable(region: TableRegion, rows: TextRow[], fontProfile: FontProfile) {
  const regionRows = rows.slice(region.startIndex, region.endIndex + 1);
  const markdownRows = regionRows.map((row) => {
    const clusters = getRowColumnClusters(row, fontProfile);
    if (!clusters) {
      return [];
    }

    return clusters.map((cluster) =>
      escapeMarkdownTableCell(stripDotLeaders(joinRowText(cluster.items)))
    );
  });

  if (markdownRows.length === 0) {
    return [];
  }

  const lines = [`| ${markdownRows[0].join(" | ")} |`, `| ${markdownRows[0].map(() => "---").join(" | ")} |`];
  for (const cells of markdownRows.slice(1)) {
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines;
}

function classifyLine(line: LineInfo, fontProfile: FontProfile): string {
  const { text, fontSize, fontName, isBullet, indentLevel, spans } = line;
  const { bodyFontSize, boldFontNames } = fontProfile;
  const sizeDelta = fontSize - bodyFontSize;

  if (isBullet) {
    return `${"  ".repeat(indentLevel)}- ${cleanBulletText(text)}`;
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

  if (boldFontNames.has(fontName) && text.length < 100 && spans.length <= 1) {
    return `**${text}**`;
  }

  return renderInlineBoldText(spans, boldFontNames);
}

export function renderPdfPageText(
  items: Array<TextItem | TextMarkedContent>,
  fontProfile?: FontProfile
) {
  const profile = fontProfile || detectFontProfile(items);
  const preparedItems = foldSuperscripts(items.filter(isTextItem));
  const rows = groupItemsByRow(preparedItems).filter((row) => joinRowText(row.items).length > 0);
  const tableRegions = detectTableRegions(rows, profile);
  const baseX = detectBaseX(rows, profile, tableRegions);
  const tableRegionByStart = new Map<number, TableRegion>(
    tableRegions.map((region) => [region.startIndex, region])
  );
  const outputLines: string[] = [];
  let previousRenderedY: number | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const tableRegion = tableRegionByStart.get(rowIndex);
    if (tableRegion) {
      if (
        previousRenderedY !== null &&
        Math.abs(rows[rowIndex].y - previousRenderedY) > profile.bodyFontSize * PARAGRAPH_GAP_FACTOR &&
        outputLines.length > 0 &&
        outputLines[outputLines.length - 1] !== ""
      ) {
        outputLines.push("");
      }

      if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== "") {
        outputLines.push("");
      }

      outputLines.push(...renderMarkdownTable(tableRegion, rows, profile));

      if (tableRegion.endIndex < rows.length - 1 && outputLines[outputLines.length - 1] !== "") {
        outputLines.push("");
      }

      previousRenderedY = rows[tableRegion.endIndex].y;
      rowIndex = tableRegion.endIndex;
      continue;
    }

    const line = buildLineInfoFromRow(rows[rowIndex], profile, baseX);
    if (!line) {
      continue;
    }

    if (
      previousRenderedY !== null &&
      Math.abs(rows[rowIndex].y - previousRenderedY) > profile.bodyFontSize * PARAGRAPH_GAP_FACTOR &&
      outputLines.length > 0 &&
      outputLines[outputLines.length - 1] !== ""
    ) {
      outputLines.push("");
    }

    const classified = stripDotLeaders(classifyLine(line, profile));
    const isHeading = /^#{1,3} /.test(classified);

    if (isHeading && outputLines.length > 0 && outputLines[outputLines.length - 1] !== "") {
      outputLines.push("");
    }

    outputLines.push(classified);

    if (isHeading) {
      outputLines.push("");
    }

    previousRenderedY = rows[rowIndex].y;
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
      MARKDOWN_BULLET_PATTERN.test(prev) &&
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
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) return false;
  if (MARKDOWN_BULLET_PATTERN.test(line)) return false;
  if (trimmed.startsWith("**")) return false;
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
    await ensureBrowserWorkerConfigured();
    const arrayBuffer = await readFileAsArrayBuffer(file);

    loadingTask = getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });

    const document = await loadingTask.promise;
    const allItems: Array<TextItem | TextMarkedContent> = [];
    const pageItemRanges: Array<{ start: number; end: number }> = [];
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const start = allItems.length;
      allItems.push(...textContent.items);
      pageItemRanges.push({ start, end: allItems.length });
      const pageItems = textContent.items.filter(isTextItem);
      let pageHeight = getEstimatedPageHeight(pageItems);

      try {
        const viewport = page.getViewport({ scale: 1 });
        if (
          viewport &&
          typeof viewport.height === "number" &&
          Number.isFinite(viewport.height) &&
          viewport.height > 0
        ) {
          pageHeight = viewport.height;
        }
      } catch {
        // Keep the max-y fallback for environments/pages where viewport lookup fails.
      }

      pages.push({ items: pageItems, height: pageHeight });
    }

    const fontProfile = detectFontProfile(allItems);
    const repeatedHeaderFooterFingerprints = detectHeaderFooterItems(pages);
    const pageTexts: string[] = [];

    for (const [pageIndex, { start, end }] of pageItemRanges.entries()) {
      const pageItems = allItems.slice(start, end);
      const strippedPageItems = stripHeaderFooterForPage(
        pages[pageIndex],
        repeatedHeaderFooterFingerprints
      );
      const strippedItems = pageItems.filter(
        (item) => !isTextItem(item) || strippedPageItems.includes(item)
      );
      pageTexts.push(renderPdfPageText(strippedItems, fontProfile));
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

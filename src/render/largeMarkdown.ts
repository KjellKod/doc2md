export interface LargeMarkdownAnalysis {
  byteLength: number;
  lineCount: number;
  tableLineCount: number;
  tableLineRatio: number;
  longestLineLength: number;
  isLargeMarkdown: boolean;
  isTableHeavy: boolean;
  useFallbackPreview: boolean;
  reason: string | null;
}

export interface LargeMarkdownTableRow {
  sourceLine: number;
  cells: string[];
}

export interface LargeMarkdownTable {
  header: string[];
  alignments: Array<"left" | "center" | "right" | null>;
  rows: LargeMarkdownTableRow[];
  tableStartLine: number;
  tableLineCount: number;
  beforeMarkdown: string;
  afterMarkdown: string;
}

const LARGE_BYTE_THRESHOLD = 512 * 1024;
const LARGE_LINE_THRESHOLD = 2_000;
const LONG_LINE_THRESHOLD = 2_000;
const TABLE_LINE_THRESHOLD = 1_000;
const TABLE_HEAVY_MIN_LINES = 100;
const TABLE_HEAVY_RATIO = 0.35;

export function analyzeLargeMarkdown(markdown: string): LargeMarkdownAnalysis {
  let byteLength = 0;
  let lineCount = 1;
  let tableLineCount = 0;
  let longestLineLength = 0;
  let currentLineLength = 0;
  let currentLinePipeCount = 0;
  let currentLineHasNonWhitespace = false;

  function finishLine() {
    longestLineLength = Math.max(longestLineLength, currentLineLength);
    if (currentLineHasNonWhitespace && currentLinePipeCount >= 2) {
      tableLineCount += 1;
    }
    currentLineLength = 0;
    currentLinePipeCount = 0;
    currentLineHasNonWhitespace = false;
  }

  for (let index = 0; index < markdown.length; index += 1) {
    const char = markdown[index];
    const code = markdown.charCodeAt(index);
    byteLength += utf8CodeUnitByteLength(code);
    if (char === "\n") {
      finishLine();
      lineCount += 1;
      continue;
    }
    if (char === "|") {
      currentLinePipeCount += 1;
    }
    if (!isWhitespaceCodeUnit(code)) {
      currentLineHasNonWhitespace = true;
    }
    currentLineLength += 1;
  }
  finishLine();

  if (markdown.length === 0) {
    lineCount = 0;
  }

  const tableLineRatio =
    lineCount === 0 ? 0 : tableLineCount / Math.max(lineCount, 1);
  const isLargeMarkdown =
    byteLength >= LARGE_BYTE_THRESHOLD ||
    lineCount >= LARGE_LINE_THRESHOLD ||
    longestLineLength >= LONG_LINE_THRESHOLD ||
    tableLineCount >= TABLE_LINE_THRESHOLD;
  const isTableHeavy =
    tableLineCount >= TABLE_HEAVY_MIN_LINES &&
    tableLineRatio >= TABLE_HEAVY_RATIO;
  const useFallbackPreview = isLargeMarkdown && isTableHeavy;

  return {
    byteLength,
    lineCount,
    tableLineCount,
    tableLineRatio,
    longestLineLength,
    isLargeMarkdown,
    isTableHeavy,
    useFallbackPreview,
    reason: useFallbackPreview
      ? `Large table-heavy Markdown (${lineCount} lines, ${tableLineCount} table lines)`
      : null,
  };
}

function utf8CodeUnitByteLength(code: number): number {
  if (code <= 0x7f) {
    return 1;
  }
  if (code <= 0x7ff) {
    return 2;
  }
  if (code >= 0xd800 && code <= 0xdfff) {
    return 2;
  }
  return 3;
}

function isWhitespaceCodeUnit(code: number): boolean {
  return code === 9 || code === 10 || code === 13 || code === 32;
}

export function parseDominantMarkdownTable(
  markdown: string,
): LargeMarkdownTable | null {
  const lines = markdown.split(/\r?\n/);
  let bestStart = -1;
  let bestEnd = -1;

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (
      !isTableLikeLine(lines[index]) ||
      !isMarkdownTableDelimiter(lines[index + 1])
    ) {
      continue;
    }

    let end = index + 2;
    while (end < lines.length && isTableLikeLine(lines[end])) {
      end += 1;
    }

    if (end - index > bestEnd - bestStart) {
      bestStart = index;
      bestEnd = end;
    }
    index = end - 1;
  }

  if (bestStart === -1 || bestEnd - bestStart < TABLE_HEAVY_MIN_LINES) {
    return null;
  }

  const tableLines = lines.slice(bestStart, bestEnd);
  const header = splitMarkdownTableLine(tableLines[0]);
  const alignments = splitMarkdownTableLine(tableLines[1]).map(parseAlignment);
  const rows = tableLines.slice(2).map((line, index) => ({
    sourceLine: bestStart + index + 3,
    cells: splitMarkdownTableLine(line),
  }));

  return {
    header,
    alignments,
    rows,
    tableStartLine: bestStart + 1,
    tableLineCount: tableLines.length,
    beforeMarkdown: lines.slice(0, bestStart).join("\n"),
    afterMarkdown: lines.slice(bestEnd).join("\n"),
  };
}

function isTableLikeLine(line: string): boolean {
  if (line.trim().length === 0) {
    return false;
  }

  let pipeCount = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "|" && !isEscaped(line, index)) {
      pipeCount += 1;
      if (pipeCount >= 2) {
        return true;
      }
    }
  }
  return false;
}

function splitMarkdownTableLine(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|") && !isEscaped(trimmed, trimmed.length - 1)) {
    trimmed = trimmed.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "|" && !isEscaped(trimmed, index)) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isMarkdownTableDelimiter(line: string): boolean {
  const cells = splitMarkdownTableLine(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function parseAlignment(cell: string): "left" | "center" | "right" | null {
  const value = cell.replace(/\s+/g, "");
  const left = value.startsWith(":");
  const right = value.endsWith(":");
  if (left && right) {
    return "center";
  }
  if (right) {
    return "right";
  }
  if (left) {
    return "left";
  }
  return null;
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

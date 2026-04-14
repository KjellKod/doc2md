import { BLOCK_ART_END_MARKER, BLOCK_ART_START_MARKER } from "./linkedinFormatting";

const LINKEDIN_FONT =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const LINKEDIN_FONT_SIZE = 14;

const FIGURE_SPACE = "\u2007";
const EM_SPACE = "\u2003";
const FULL_BLOCK = "\u2588";

// Only normalize ═ (double horizontal, U+2550) which appears in long runs
// and causes the most cumulative drift (13.75px vs █ at 14.00px).
// Single corner/edge characters (╗╚╝╔║ etc.) barely affect alignment
// and provide visual shape to the letters.
const LONG_RUN_NARROW_CHARS = /\u2550/gu;

// Unicode spaces sorted widest-first for greedy fitting.
const CANDIDATE_SPACES = [
  "\u2003", // em space
  "\u2002", // en space
  "\u2007", // figure space
  "\u2005", // four-per-em space
  "\u2004", // three-per-em space
  "\u2009", // thin space
  "\u200A", // hair space
];

interface MeasuredSpaces {
  char: string;
  width: number;
}

let cachedCtx: CanvasRenderingContext2D | null = null;
let cachedCharWidths: Map<string, number> | null = null;
let cachedSpaceWidths: MeasuredSpaces[] | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (cachedCtx) {
    return cachedCtx;
  }

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    ctx.font = `${LINKEDIN_FONT_SIZE}px ${LINKEDIN_FONT}`;
    cachedCtx = ctx;
    return ctx;
  } catch {
    return null;
  }
}

function measureChar(ctx: CanvasRenderingContext2D, char: string): number {
  return ctx.measureText(char).width;
}

function getCharWidth(char: string): number | null {
  if (!cachedCharWidths) {
    cachedCharWidths = new Map();
  }

  const cached = cachedCharWidths.get(char);

  if (cached !== undefined) {
    return cached;
  }

  const ctx = getContext();

  if (!ctx) {
    return null;
  }

  const width = measureChar(ctx, char);
  cachedCharWidths.set(char, width);
  return width;
}

function getSpaceWidths(): MeasuredSpaces[] | null {
  if (cachedSpaceWidths) {
    return cachedSpaceWidths;
  }

  const ctx = getContext();

  if (!ctx) {
    return null;
  }

  cachedSpaceWidths = CANDIDATE_SPACES.map((char) => ({
    char,
    width: measureChar(ctx, char),
  })).sort((a, b) => b.width - a.width);

  return cachedSpaceWidths;
}

/**
 * Build a string of Unicode spaces whose total width is as close
 * to `targetWidth` as possible.
 */
function fitSpaces(targetWidth: number, spaces: MeasuredSpaces[]): string {
  if (targetWidth <= 0.5) {
    return "";
  }

  let remaining = targetWidth;
  let result = "";

  for (const space of spaces) {
    while (remaining >= space.width - 0.5) {
      result += space.char;
      remaining -= space.width;
    }
  }

  if (result.length === 0 && targetWidth > 0.5) {
    result = "\u200A";
  }

  return result;
}

/**
 * Compute per-column target widths for a block of lines.
 *
 * For each column index, find the MAX character width across all lines.
 * This ensures that every line, after compensation, aligns at every column.
 */
function computeColumnTargets(lineChars: string[][]): number[] {
  const maxCols = Math.max(...lineChars.map((chars) => chars.length));
  const targets: number[] = [];

  for (let col = 0; col < maxCols; col++) {
    let maxWidth = 0;

    for (const chars of lineChars) {
      if (col < chars.length) {
        const char = chars[col];
        const width = getCharWidth(char) ?? 8;

        if (width > maxWidth) {
          maxWidth = width;
        }
      }
    }

    targets.push(maxWidth);
  }

  return targets;
}

/**
 * Compensate one line using per-column targets.
 *
 * Walk the line character by character. Track "target X" (cumulative
 * column targets) vs "actual X" (measured widths). At each space,
 * emit Unicode spaces to close the gap so the next character starts
 * at the correct column position.
 */
function compensateLine(
  chars: string[],
  columnTargets: number[],
  spaces: MeasuredSpaces[],
): string {
  let result = "";
  let targetX = 0;
  let actualX = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const isSpace = char === " " || char === FIGURE_SPACE;
    const colTarget = i < columnTargets.length ? columnTargets[i] : (getCharWidth(char) ?? 8);

    if (isSpace) {
      // Advance target by this column's target width
      targetX += colTarget;
      // Emit spaces to bridge from actualX to targetX
      const needed = targetX - actualX;
      const spaceFill = fitSpaces(needed, spaces);

      let emittedWidth = 0;

      for (const c of Array.from(spaceFill)) {
        emittedWidth += getCharWidth(c) ?? 0;
      }

      actualX += emittedWidth;
      result += spaceFill;
    } else {
      const charWidth = getCharWidth(char) ?? 8;
      targetX += colTarget;
      actualX += charWidth;
      result += char;
    }
  }

  return result;
}

function stripMarkers(text: string): string {
  return text
    .replaceAll(BLOCK_ART_START_MARKER, "")
    .replaceAll(BLOCK_ART_END_MARKER, "");
}

/**
 * Process the full formatted LinkedIn text:
 * - Find block art sections (between start/end markers)
 * - Compute per-column alignment targets across all lines in each block
 * - Compensate spacing for LinkedIn's proportional font
 * - Strip markers
 * - Leave non-block-art text unchanged
 */
export function compensateForLinkedIn(text: string): string {
  // Simple and effective: replace figure spaces (8.67px) with em spaces
  // (13.85px). Block art characters are ~14px wide in LinkedIn's font,
  // so one em space ≈ one character width. This gives near-perfect
  // column alignment without complex per-character computation.
  //
  // Measured on macOS with LinkedIn's font stack:
  //   █ = 14.00px, ═║╔╗╚╝ = 13.75px, em space = 13.85px
  //
  // The complex per-column approach is preserved below but bypassed
  // in favor of this empirically simpler solution.
  return stripMarkers(text)
    .replaceAll(FIGURE_SPACE, EM_SPACE)
    .replace(LONG_RUN_NARROW_CHARS, FULL_BLOCK);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reset caches (useful for testing). */
export function resetMeasurementCache(): void {
  cachedCtx = null;
  cachedCharWidths = null;
  cachedSpaceWidths = null;
}

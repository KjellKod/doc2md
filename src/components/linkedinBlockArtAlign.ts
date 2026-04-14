import { BLOCK_ART_END_MARKER, BLOCK_ART_START_MARKER } from "./linkedinFormatting";

const LINKEDIN_FONT =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const LINKEDIN_FONT_SIZE = 14;

const FIGURE_SPACE = "\u2007";

// Unicode spaces sorted widest-first for greedy fitting.
// LinkedIn may strip some of these — we include all and let testing determine
// which survive. The greedy fitter picks the fewest characters possible.
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
 * to `targetWidth` as possible without exceeding it by more than 0.5px.
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

  // If we couldn't fit anything (targetWidth < smallest space), use a hair space
  if (result.length === 0 && targetWidth > 0.5) {
    result = "\u200A";
  }

  return result;
}

/**
 * Compensate one line of block art so that column positions match
 * what they would be in a monospace font.
 *
 * Strategy: walk the line character by character, tracking both the
 * "monospace target" x-position and the "proportional actual" x-position.
 * At every space, emit Unicode spaces whose total width bridges the gap
 * so the next non-space character starts at the correct column.
 */
function compensateLine(
  line: string,
  monoWidth: number,
  spaces: MeasuredSpaces[],
): string {
  const chars = Array.from(line);
  let result = "";
  let targetX = 0;
  let actualX = 0;

  for (const char of chars) {
    const isSpace = char === " " || char === FIGURE_SPACE;

    if (isSpace) {
      targetX += monoWidth;
      const needed = targetX - actualX;
      const spaceFill = fitSpaces(needed, spaces);

      let emittedWidth = 0;

      for (const c of Array.from(spaceFill)) {
        emittedWidth += getCharWidth(c) ?? 0;
      }

      actualX += emittedWidth;
      result += spaceFill;
    } else {
      const charWidth = getCharWidth(char) ?? monoWidth;
      targetX += monoWidth;
      actualX += charWidth;
      result += char;
    }
  }

  return result;
}

/**
 * Process the full formatted LinkedIn text:
 * - Find block art sections (between start/end markers)
 * - Compensate their spacing for LinkedIn's proportional font
 * - Strip markers
 * - Leave non-block-art text unchanged
 */
/**
 * Strip block art markers from text (fallback when canvas is unavailable).
 */
function stripMarkers(text: string): string {
  return text
    .replaceAll(BLOCK_ART_START_MARKER, "")
    .replaceAll(BLOCK_ART_END_MARKER, "");
}

export function compensateForLinkedIn(text: string): string {
  const spaces = getSpaceWidths();

  // If canvas measurement is unavailable (e.g. jsdom in tests),
  // fall back to stripping markers and keeping figure spaces as-is.
  if (!spaces) {
    return stripMarkers(text);
  }

  const monoWidth = getCharWidth("\u2588") ?? getCharWidth("0") ?? 8;

  const parts = text.split(
    new RegExp(`(${escapeRegex(BLOCK_ART_START_MARKER)}|${escapeRegex(BLOCK_ART_END_MARKER)})`)
  );

  let inBlockArt = false;
  const output: string[] = [];

  for (const part of parts) {
    if (part === BLOCK_ART_START_MARKER) {
      inBlockArt = true;
      continue;
    }

    if (part === BLOCK_ART_END_MARKER) {
      inBlockArt = false;
      continue;
    }

    if (inBlockArt) {
      const lines = part.split("\n");
      const compensated = lines.map((line) =>
        compensateLine(line, monoWidth, spaces),
      );
      output.push(compensated.join("\n"));
    } else {
      output.push(part);
    }
  }

  return output.join("");
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

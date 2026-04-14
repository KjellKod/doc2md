import { BLOCK_ART_END_MARKER, BLOCK_ART_START_MARKER } from "./linkedinFormatting";

const LINKEDIN_FONT =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const LINKEDIN_FONT_SIZE = 14;

const FIGURE_SPACE = "\u2007";

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

interface Segment {
  text: string;
  isSpace: boolean;
}

let cachedCtx: CanvasRenderingContext2D | null = null;
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

function measureString(str: string): number | null {
  const ctx = getContext();

  if (!ctx) {
    return null;
  }

  return ctx.measureText(str).width;
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
    width: ctx.measureText(char).width,
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
 * Split a line into alternating segments of non-space text and spaces.
 * E.g., "██╗  ██║" → [{text:"██╗", isSpace:false}, {text:"  ", isSpace:true}, {text:"██║", isSpace:false}]
 */
function splitSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  const chars = Array.from(line);
  let current = "";
  let currentIsSpace = false;

  for (const char of chars) {
    const isSpace = char === " " || char === FIGURE_SPACE;

    if (current.length === 0) {
      current = char;
      currentIsSpace = isSpace;
      continue;
    }

    if (isSpace === currentIsSpace) {
      current += char;
    } else {
      segments.push({ text: current, isSpace: currentIsSpace });
      current = char;
      currentIsSpace = isSpace;
    }
  }

  if (current.length > 0) {
    segments.push({ text: current, isSpace: currentIsSpace });
  }

  return segments;
}

/**
 * Segment-based compensation.
 *
 * Instead of measuring individual characters, measure entire text segments
 * as whole strings (accounting for rendering quirks, kerning, etc.).
 *
 * For each segment position across all lines, find the MAX text segment width.
 * Then at each space gap, emit Unicode spaces to align the next text segment
 * to its target start position.
 *
 * This approach:
 * - Measures "██████╗" as one string, not 7 individual characters
 * - Aligns at natural word/gap boundaries, where alignment matters most
 * - Avoids cumulative rounding errors from per-character measurement
 */
function compensateBlock(
  lines: string[],
  spaces: MeasuredSpaces[],
): string[] {
  // Parse all lines into segments
  const allSegments = lines.map(splitSegments);

  // Find the maximum number of segments across all lines
  const maxSegments = Math.max(...allSegments.map((s) => s.length));

  // For each segment index, compute the target width.
  // Text segments: max width across all lines at that index.
  // Space segments: max width (in monospace equivalent) across all lines.
  // We need the target START position for each text segment to be consistent.

  // Compute target start position for each segment index.
  // Walk through segment positions and accumulate max widths.
  const segmentTargetWidths: number[] = [];

  for (let si = 0; si < maxSegments; si++) {
    let maxWidth = 0;

    for (const segments of allSegments) {
      if (si >= segments.length) {
        continue;
      }

      const seg = segments[si];
      const width = seg.isSpace
        ? (measureString(seg.text) ?? seg.text.length * 4)
        : (measureString(seg.text) ?? seg.text.length * 8);

      if (width > maxWidth) {
        maxWidth = width;
      }
    }

    segmentTargetWidths.push(maxWidth);
  }

  // Now compensate each line
  return lines.map((line, li) => {
    const segments = allSegments[li];
    let result = "";
    let targetX = 0;
    let actualX = 0;

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const targetWidth = si < segmentTargetWidths.length ? segmentTargetWidths[si] : 0;

      if (seg.isSpace) {
        // Advance target by the target width for this space segment
        targetX += targetWidth;
        // Emit spaces to bridge from actualX to targetX
        const needed = targetX - actualX;
        const spaceFill = fitSpaces(needed, spaces);
        const fillWidth = measureString(spaceFill) ?? 0;
        actualX += fillWidth;
        result += spaceFill;
      } else {
        // Text segment: emit as-is, measure actual width
        const textWidth = measureString(seg.text) ?? seg.text.length * 8;
        targetX += targetWidth;
        actualX += textWidth;
        result += seg.text;
      }
    }

    return result;
  });
}

function stripMarkers(text: string): string {
  return text
    .replaceAll(BLOCK_ART_START_MARKER, "")
    .replaceAll(BLOCK_ART_END_MARKER, "");
}

/**
 * Process the full formatted LinkedIn text:
 * - Find block art sections (between start/end markers)
 * - Compensate spacing using segment-based alignment
 * - Strip markers
 * - Leave non-block-art text unchanged
 */
export function compensateForLinkedIn(text: string): string {
  const spaces = getSpaceWidths();

  if (!spaces) {
    return stripMarkers(text);
  }

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
      const compensated = compensateBlock(lines, spaces);
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
  cachedSpaceWidths = null;
}

/** Debug: dump character width measurements to console. */
export function debugCharWidths(): void {
  const ctx = getContext();

  if (!ctx) {
    console.log("[blockArtAlign] Canvas not available");
    return;
  }

  console.log(`[blockArtAlign] Font: ${LINKEDIN_FONT_SIZE}px ${LINKEDIN_FONT}`);

  // Measure block art characters
  const testChars = ["█", "═", "║", "╔", "╗", "╚", "╝", "╠", "╣", "─", "│", "╰", "╯", "▄", "▀"];

  console.log("[blockArtAlign] Character widths:");

  for (const char of testChars) {
    const width = ctx.measureText(char).width;
    console.log(`  ${char} (U+${char.codePointAt(0)?.toString(16).padStart(4, "0")}) → ${width.toFixed(2)}px`);
  }

  // Measure spaces
  console.log("[blockArtAlign] Space widths:");
  const spaceChars = [
    { char: " ", name: "regular" },
    { char: "\u2007", name: "figure" },
    { char: "\u2003", name: "em" },
    { char: "\u2002", name: "en" },
    { char: "\u2009", name: "thin" },
    { char: "\u200A", name: "hair" },
  ];

  for (const { char, name } of spaceChars) {
    console.log(`  ${name}: ${ctx.measureText(char).width.toFixed(2)}px`);
  }

  // Measure full segments from RIP
  console.log("[blockArtAlign] RIP segment widths:");
  const segments = ["██████╗", "██╔══██╗", "██████╔╝", "██║", "╚═╝", "██╗", "██████╗"];

  for (const seg of segments) {
    const measured = ctx.measureText(seg).width;
    console.log(`  "${seg}" → ${measured.toFixed(2)}px`);
  }
}

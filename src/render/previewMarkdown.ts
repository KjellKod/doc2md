const MARKDOWN_STRUCTURAL_LINE = /^(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+|[`~]{3,}|[-*_]{3,}\s*$)/;
const MARKDOWN_TABLE_LINE = /^\|.+\|$|^:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*$/;
const HEADING_PUNCTUATION = /[.!?;:]$/;
const METADATA_LABEL = /^([A-Za-z][A-Za-z0-9/&()' -]{1,42}):\s+(.+)$/;
const LINKISH_VALUE = /(https?:\/\/|www\.|@|(?:\+?\d[\d()\s-]{6,}\d))/i;
const INDENTED_CODE_LINE = /^(?: {4}|\t)/;

interface SourceLine {
  text: string;
  source: number; // 1-based line number in the original markdown
}

function isStructuralLine(line: string) {
  return MARKDOWN_STRUCTURAL_LINE.test(line) || MARKDOWN_TABLE_LINE.test(line);
}

function isCompactLine(line: string) {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.length <= 88;
}

function endsLikeSentence(line: string) {
  return /[.!?]["')\]]?$/.test(line.trim());
}

function looksLikeMetadataLine(line: string) {
  const trimmed = line.trim();

  if (!isCompactLine(trimmed)) {
    return false;
  }

  return METADATA_LABEL.test(trimmed) || LINKISH_VALUE.test(trimmed);
}

function looksLikeHeadingCandidate(line: string) {
  const trimmed = line.trim();

  if (trimmed.length < 3 || trimmed.length > 38) {
    return false;
  }

  if (HEADING_PUNCTUATION.test(trimmed) || isStructuralLine(trimmed)) {
    return false;
  }

  if (!/^[A-Za-z0-9/&()' -]+$/.test(trimmed)) {
    return false;
  }

  return trimmed.split(/\s+/).length <= 5;
}

function normalizeMetadataLine(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(METADATA_LABEL);

  if (!match) {
    return `- ${trimmed}`;
  }

  const [, label, value] = match;
  return `- **${label.trim()}:** ${value.trim()}`;
}

function normalizeCompactListLine(line: string) {
  return `- ${line.trim()}`;
}

function formatDenseBlockWithSources(block: SourceLine[]): SourceLine[] {
  if (block.length < 2) {
    return block;
  }

  // Filter out blank lines (mirroring the original `trim()` + filter Boolean)
  // but keep their original-line references with the kept entries.
  const trimmedLines = block
    .map((entry) => ({ text: entry.text.trim(), source: entry.source }))
    .filter((entry) => entry.text.length > 0);

  if (trimmedLines.length < 2) {
    return block;
  }

  let heading: SourceLine | null = null;
  let content = trimmedLines;

  if (
    trimmedLines.length >= 3 &&
    looksLikeHeadingCandidate(trimmedLines[0].text)
  ) {
    const remainingLines = trimmedLines.slice(1);
    const remainingMetadataCount = remainingLines.filter((entry) =>
      looksLikeMetadataLine(entry.text),
    ).length;
    const remainingMetadataHeavy =
      remainingMetadataCount >=
      Math.max(2, Math.ceil(remainingLines.length * 0.5));

    if (
      remainingLines.every((entry) => isCompactLine(entry.text)) &&
      remainingMetadataHeavy
    ) {
      heading = trimmedLines[0];
      content = remainingLines;
    }
  }

  const metadataCount = content.filter((entry) =>
    looksLikeMetadataLine(entry.text),
  ).length;
  const compactCount = content.filter((entry) =>
    isCompactLine(entry.text),
  ).length;
  const sentenceCount = content.filter((entry) =>
    endsLikeSentence(entry.text),
  ).length;
  const metadataHeavy =
    metadataCount >= Math.max(2, Math.ceil(content.length * 0.5));
  const compactCluster =
    content.length >= 4 &&
    compactCount === content.length &&
    sentenceCount <= 1;

  if (!metadataHeavy && !compactCluster) {
    return block;
  }

  const rendered: SourceLine[] = [];

  if (heading) {
    rendered.push({ text: `### ${heading.text}`, source: heading.source });
    // Synthetic blank inherits the heading's source.
    rendered.push({ text: "", source: heading.source });
  }

  const formatter = metadataHeavy
    ? normalizeMetadataLine
    : normalizeCompactListLine;

  for (const entry of content) {
    rendered.push({ text: formatter(entry.text), source: entry.source });
  }

  return rendered;
}

function isValidClosingFence(trimmed: string): boolean {
  return /^[`~]+\s*$/.test(trimmed);
}

export function formatPreviewMarkdownWithLineMap(markdown: string): {
  markdown: string;
  originalLineFor: number[];
} {
  if (markdown.length === 0) {
    return { markdown: "", originalLineFor: [] };
  }

  const lines = markdown.split(/\r?\n/);
  const formatted: SourceLine[] = [];
  let block: SourceLine[] = [];
  let fenceChar: string | null = null;

  const flushBlock = () => {
    if (block.length > 0) {
      formatted.push(...formatDenseBlockWithSources(block));
      block = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sourceLine = index + 1;
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const char = fenceMatch[1][0];

      if (fenceChar === null) {
        flushBlock();
        fenceChar = char;
        formatted.push({ text: line, source: sourceLine });
        continue;
      }

      if (char === fenceChar && isValidClosingFence(trimmed)) {
        fenceChar = null;
        formatted.push({ text: line, source: sourceLine });
        continue;
      }

      formatted.push({ text: line, source: sourceLine });
      continue;
    }

    if (fenceChar !== null) {
      formatted.push({ text: line, source: sourceLine });
      continue;
    }

    if (trimmed.length === 0) {
      flushBlock();
      formatted.push({ text: "", source: sourceLine });
      continue;
    }

    if (INDENTED_CODE_LINE.test(line)) {
      flushBlock();
      formatted.push({ text: line, source: sourceLine });
      continue;
    }

    if (isStructuralLine(trimmed)) {
      flushBlock();
      formatted.push({ text: line, source: sourceLine });
      continue;
    }

    block.push({ text: line, source: sourceLine });
  }

  flushBlock();

  return collapseBlankLinesOutsideFencesWithSources(formatted);
}

export function formatPreviewMarkdown(markdown: string): string {
  return formatPreviewMarkdownWithLineMap(markdown).markdown;
}

function collapseBlankLinesOutsideFencesWithSources(
  entries: SourceLine[],
): { markdown: string; originalLineFor: number[] } {
  const result: SourceLine[] = [];
  let fence: string | null = null;
  let consecutiveBlanks = 0;

  for (const entry of entries) {
    const trimmed = entry.text.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (fence === null) {
        fence = char;
      } else if (char === fence && isValidClosingFence(trimmed)) {
        fence = null;
      }
      consecutiveBlanks = 0;
      result.push(entry);
      continue;
    }

    if (fence !== null) {
      result.push(entry);
      continue;
    }

    if (trimmed.length === 0) {
      consecutiveBlanks += 1;
      if (consecutiveBlanks <= 1) {
        result.push(entry);
      }
    } else {
      consecutiveBlanks = 0;
      result.push(entry);
    }
  }

  const markdown = result.map((entry) => entry.text).join("\n");
  const originalLineFor = result.map((entry) => entry.source);

  return { markdown, originalLineFor };
}

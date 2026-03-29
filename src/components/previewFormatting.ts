const MARKDOWN_STRUCTURAL_LINE = /^(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+|[`~]{3,}|[-*_]{3,}\s*$)/;
const MARKDOWN_TABLE_LINE = /^\|.+\|$|^:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*$/;
const HEADING_PUNCTUATION = /[.!?;:]$/;
const METADATA_LABEL = /^([A-Za-z][A-Za-z0-9/&()' -]{1,42}):\s+(.+)$/;
const LINKISH_VALUE = /(https?:\/\/|www\.|@|(?:\+?\d[\d()\s-]{6,}\d))/i;

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

function formatDenseBlock(lines: string[]) {
  if (lines.length < 2) {
    return lines;
  }

  const trimmedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmedLines.length < 2) {
    return lines;
  }

  let heading: string | null = null;
  let content = trimmedLines;

  if (trimmedLines.length >= 3 && looksLikeHeadingCandidate(trimmedLines[0])) {
    const remainingLines = trimmedLines.slice(1);
    const remainingMetadataCount = remainingLines.filter(looksLikeMetadataLine).length;
    const remainingMetadataHeavy =
      remainingMetadataCount >= Math.max(2, Math.ceil(remainingLines.length * 0.5));

    if (remainingLines.every(isCompactLine) && remainingMetadataHeavy) {
      heading = trimmedLines[0];
      content = remainingLines;
    }
  }

  const metadataCount = content.filter(looksLikeMetadataLine).length;
  const compactCount = content.filter(isCompactLine).length;
  const sentenceCount = content.filter(endsLikeSentence).length;
  const metadataHeavy = metadataCount >= Math.max(2, Math.ceil(content.length * 0.5));
  const compactCluster =
    content.length >= 4 &&
    compactCount === content.length &&
    sentenceCount <= 1;

  if (!metadataHeavy && !compactCluster) {
    return lines;
  }

  const renderedLines = heading ? [`### ${heading}`, ""] : [];
  const formatter = metadataHeavy ? normalizeMetadataLine : normalizeCompactListLine;

  renderedLines.push(...content.map(formatter));
  return renderedLines;
}

export function formatPreviewMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const formatted: string[] = [];
  let block: string[] = [];
  let fenceChar: string | null = null;

  const flushBlock = () => {
    if (block.length > 0) {
      formatted.push(...formatDenseBlock(block));
      block = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const char = fenceMatch[1][0];

      if (fenceChar === null) {
        // Opening a new fence
        flushBlock();
        fenceChar = char;
        formatted.push(line);
        continue;
      }

      if (char === fenceChar) {
        // Closing the fence with a matching marker
        fenceChar = null;
        formatted.push(line);
        continue;
      }

      // Mismatched fence marker inside a code block — pass through
      formatted.push(line);
      continue;
    }

    if (fenceChar !== null) {
      formatted.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      flushBlock();
      formatted.push("");
      continue;
    }

    if (isStructuralLine(trimmed)) {
      flushBlock();
      formatted.push(line);
      continue;
    }

    block.push(line);
  }

  flushBlock();

  return collapseBlankLinesOutsideFences(formatted.join("\n"));
}

function collapseBlankLinesOutsideFences(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let fence: string | null = null;
  let consecutiveBlanks = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (fence === null) {
        fence = char;
      } else if (char === fence) {
        fence = null;
      }
      consecutiveBlanks = 0;
      result.push(line);
      continue;
    }

    if (fence !== null) {
      result.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      consecutiveBlanks++;
      if (consecutiveBlanks <= 1) {
        result.push(line);
      }
    } else {
      consecutiveBlanks = 0;
      result.push(line);
    }
  }

  return result.join("\n");
}

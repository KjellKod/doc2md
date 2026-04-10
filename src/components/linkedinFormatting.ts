const FENCE_LINE = /^(`{3,}|~{3,})/;
const HEADING_LINE = /^\s*(#{1,6})\s+(.*)$/;
const UNORDERED_LIST_LINE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_LIST_LINE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BLOCKQUOTE_LINE = /^\s*>\s?(.*)$/;
const HORIZONTAL_RULE_LINE =
  /^\s{0,3}(?:(?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/;
const INDENTED_CODE_LINE = /^(?: {4}|\t)(.*)$/;
const HTML_TAG = /<\/?[A-Za-z][^>]*>/;
const TABLE_SEPARATOR_LINE =
  /^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/;
const METADATA_LINE =
  /^(?:\*\*)?([A-Za-z][A-Za-z0-9/&()' -]{1,42})(?::)(?:\*\*)?\s+(.+)$/;
const URL_OR_EMAIL = /(?:https?:\/\/\S+|www\.\S+|\b\S+@\S+\b)/;
const MARKDOWN_AUTOLINK = /<(?:https?:\/\/|www\.)[^>\s]+>/g;

type InlineStyle = "bold" | "italic" | "boldItalic" | "underline" | "strike";

const BULLETS = ["•", "◦", "▪"];

function isClosingFence(trimmed: string) {
  return /^[`~]+\s*$/.test(trimmed);
}

function stripInlineCodeSegments(line: string) {
  return line.replace(/`[^`]*`/g, "");
}

function stripMarkdownAutolinks(line: string) {
  return line.replace(MARKDOWN_AUTOLINK, "");
}

function previousNonBlank(lines: string[], index: number) {
  for (let current = index - 1; current >= 0; current -= 1) {
    if (lines[current].trim().length > 0) {
      return lines[current];
    }
  }

  return null;
}

function nextNonBlank(lines: string[], index: number) {
  for (let current = index + 1; current < lines.length; current += 1) {
    if (lines[current].trim().length > 0) {
      return lines[current];
    }
  }

  return null;
}

function looksLikePipeRow(line: string) {
  const trimmed = line.trim();

  if (!trimmed.includes("|")) {
    return false;
  }

  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
    return trimmed.split("|").filter((cell) => cell.trim().length > 0).length >= 2;
  }

  return /\S+\s*\|\s*\S+/.test(trimmed);
}

function collectDetectionLines(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const cleaned: string[] = [];
  let fenceChar: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(FENCE_LINE);

    if (fenceMatch) {
      const char = fenceMatch[1][0];

      if (fenceChar === null) {
        fenceChar = char;
        continue;
      }

      if (char === fenceChar && isClosingFence(trimmed)) {
        fenceChar = null;
      }

      continue;
    }

    if (fenceChar !== null) {
      continue;
    }

    cleaned.push(stripMarkdownAutolinks(stripInlineCodeSegments(line)));
  }

  return cleaned;
}

export function detectUnsupportedConstructs(markdown: string) {
  const lines = collectDetectionLines(markdown);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    if (HTML_TAG.test(trimmed)) {
      return "LinkedIn view is unavailable for Markdown that includes HTML tags.";
    }

    if (TABLE_SEPARATOR_LINE.test(trimmed)) {
      return "LinkedIn view is unavailable for Markdown tables.";
    }

    if (!looksLikePipeRow(trimmed)) {
      continue;
    }

    const previous = previousNonBlank(lines, index);
    const next = nextNonBlank(lines, index);

    if (
      (previous &&
        (TABLE_SEPARATOR_LINE.test(previous.trim()) ||
          looksLikePipeRow(previous.trim()))) ||
      (next &&
        (TABLE_SEPARATOR_LINE.test(next.trim()) || looksLikePipeRow(next.trim())))
    ) {
      return "LinkedIn view is unavailable for Markdown tables.";
    }
  }

  return null;
}

function mapMathematicalLetter(
  char: string,
  uppercaseBase: number,
  lowercaseBase: number,
) {
  const codePoint = char.codePointAt(0);

  if (!codePoint) {
    return char;
  }

  if (codePoint >= 65 && codePoint <= 90) {
    return String.fromCodePoint(uppercaseBase + (codePoint - 65));
  }

  if (codePoint >= 97 && codePoint <= 122) {
    const mapped = lowercaseBase + (codePoint - 97);
    // U+1D455 is unassigned; the correct italic lowercase 'h' is U+210E
    if (mapped === 0x1d455) {
      return String.fromCodePoint(0x210e);
    }
    return String.fromCodePoint(mapped);
  }

  return char;
}

function stylizeCharacters(text: string, style: InlineStyle) {
  if (style === "underline" || style === "strike") {
    const mark = style === "underline" ? "\u0332" : "\u0336";
    return Array.from(text)
      .map((char) => (/\s/.test(char) ? char : `${char}${mark}`))
      .join("");
  }

  return Array.from(text)
    .map((char) => {
      if (style === "bold") {
        return mapMathematicalLetter(char, 0x1d400, 0x1d41a);
      }

      if (style === "italic") {
        return mapMathematicalLetter(char, 0x1d434, 0x1d44e);
      }

      return mapMathematicalLetter(char, 0x1d468, 0x1d482);
    })
    .join("");
}

function renderInlineFormatting(text: string) {
  let formatted = text;

  formatted = formatted.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, alt: string, url: string) => {
      const label = alt.trim();
      return label.length > 0 ? `${label}: ${url}` : url;
    },
  );
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label: string, url: string) =>
      `${renderInlineFormatting(label).trim()}: ${url}`,
  );
  formatted = formatted.replace(/<(https?:\/\/[^>]+)>/g, "$1");
  formatted = formatted.replace(/~~`([^`]+)`~~/g, (_, value: string) =>
    stylizeCharacters(value, "strike"),
  );
  formatted = formatted.replace(
    /(?:\*\*\*|___)`([^`]+)`(?:\*\*\*|___)/g,
    (_, value: string) => stylizeCharacters(value, "boldItalic"),
  );
  formatted = formatted.replace(
    /(?:\*\*|__)`([^`]+)`(?:\*\*|__)/g,
    (_, value: string) => stylizeCharacters(value, "bold"),
  );
  formatted = formatted.replace(
    /(^|[^*])\*`([^`]+)`\*(?!\*)/g,
    (_, prefix: string, value: string) =>
      `${prefix}${stylizeCharacters(value, "italic")}`,
  );
  formatted = formatted.replace(
    /(^|[^\w_])_`([^`]+)`_(?!\w)/g,
    (_, prefix: string, value: string) =>
      `${prefix}${stylizeCharacters(value, "italic")}`,
  );

  const segments = formatted.split(/(`[^`]+`|https?:\/\/\S+|www\.\S+|\b\S+@\S+\b)/g);

  formatted = segments
    .map((segment) => {
      if (segment.length === 0) {
        return segment;
      }

      if (/^`[^`]+`$/.test(segment)) {
        return segment.slice(1, -1);
      }

      if (URL_OR_EMAIL.test(segment)) {
        return segment;
      }

      let styled = segment;
      styled = styled.replace(/~~([^~]+)~~/g, (_, value: string) =>
        stylizeCharacters(value, "strike"),
      );
      styled = styled.replace(
        /(?:\*\*\*|___)(.+?)(?:\*\*\*|___)/g,
        (_, value: string) => stylizeCharacters(value, "boldItalic"),
      );
      styled = styled.replace(
        /(?:\*\*|__)(.+?)(?:\*\*|__)/g,
        (_, value: string) => stylizeCharacters(value, "bold"),
      );
      styled = styled.replace(
        /(^|[^*])\*([^*\n]+)\*(?!\*)/g,
        (_, prefix: string, value: string) =>
          `${prefix}${stylizeCharacters(value, "italic")}`,
      );
      styled = styled.replace(
        /(^|[^\w_])_([^_\n]+)_(?!\w)/g,
        (_, prefix: string, value: string) =>
          `${prefix}${stylizeCharacters(value, "italic")}`,
      );
      return styled;
    })
    .join("");

  formatted = formatted.replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, "$1");
  formatted = formatted.replace(/\s+/g, " ").trim();

  return formatted;
}

function headingUnderline(text: string, level: number) {
  const char = level === 1 ? "═" : "─";
  return char.repeat(Math.max(3, Array.from(text).length));
}

function bulletForLevel(level: number) {
  return BULLETS[Math.min(level, BULLETS.length - 1)];
}

function flushParagraph(buffer: string[], output: string[]) {
  if (buffer.length === 0) {
    return;
  }

  const metadataMatches = buffer.map((line) => line.match(METADATA_LINE));

  if (buffer.length >= 2 && metadataMatches.every(Boolean)) {
    for (const match of metadataMatches) {
      const [, label, value] = match!;
      output.push(`• ${label.trim()}: ${renderInlineFormatting(value)}`);
    }
    buffer.length = 0;
    return;
  }

  output.push(renderInlineFormatting(buffer.join(" ")));
  buffer.length = 0;
}

function collapseBlankLines(lines: string[]) {
  const collapsed: string[] = [];
  let lastBlank = false;

  for (const line of lines) {
    const isBlank = line.trim().length === 0;

    if (isBlank) {
      if (!lastBlank) {
        collapsed.push("");
      }
    } else {
      collapsed.push(line);
    }

    lastBlank = isBlank;
  }

  while (collapsed[0]?.trim().length === 0) {
    collapsed.shift();
  }

  while (collapsed.length > 0 && collapsed[collapsed.length - 1]?.trim().length === 0) {
    collapsed.pop();
  }

  return collapsed.join("\n");
}

export function formatLinkedInUnicode(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  const paragraph: string[] = [];
  let fenceChar: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(FENCE_LINE);

    if (fenceMatch) {
      const char = fenceMatch[1][0];

      if (fenceChar === null) {
        flushParagraph(paragraph, output);
        fenceChar = char;
        continue;
      }

      if (char === fenceChar && isClosingFence(trimmed)) {
        fenceChar = null;
      }

      continue;
    }

    if (fenceChar !== null) {
      output.push(`  ${line}`);
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph(paragraph, output);
      output.push("");
      continue;
    }

    const indentedCodeMatch = line.match(INDENTED_CODE_LINE);
    if (indentedCodeMatch) {
      flushParagraph(paragraph, output);
      output.push(`  ${indentedCodeMatch[1]}`);
      continue;
    }

    const headingMatch = trimmed.match(HEADING_LINE);
    if (headingMatch) {
      flushParagraph(paragraph, output);
      const level = headingMatch[1].length;
      const text = renderInlineFormatting(headingMatch[2]);

      output.push(text);
      output.push(headingUnderline(text, level));
      output.push("");
      continue;
    }

    if (HORIZONTAL_RULE_LINE.test(trimmed)) {
      flushParagraph(paragraph, output);
      output.push("──────");
      output.push("");
      continue;
    }

    const blockquoteMatch = line.match(BLOCKQUOTE_LINE);
    if (blockquoteMatch) {
      flushParagraph(paragraph, output);
      output.push(`│ ${renderInlineFormatting(blockquoteMatch[1])}`);
      continue;
    }

    const unorderedMatch = line.match(UNORDERED_LIST_LINE);
    if (unorderedMatch) {
      flushParagraph(paragraph, output);
      const level = Math.floor(unorderedMatch[1].length / 2);
      output.push(
        `${"  ".repeat(level)}${bulletForLevel(level)} ${renderInlineFormatting(unorderedMatch[2])}`,
      );
      continue;
    }

    const orderedMatch = line.match(ORDERED_LIST_LINE);
    if (orderedMatch) {
      flushParagraph(paragraph, output);
      const level = Math.floor(orderedMatch[1].length / 2);
      output.push(
        `${"  ".repeat(level)}${orderedMatch[2]}. ${renderInlineFormatting(orderedMatch[3])}`,
      );
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph(paragraph, output);

  return collapseBlankLines(output);
}

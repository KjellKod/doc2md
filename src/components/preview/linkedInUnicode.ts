import { stylizeLinkedInCharacters } from "../linkedinFormatting";

const ASCII_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const COMBINING_STRIKE = "\u0336";
const COMBINING_UNDERLINE = "\u0332";

type ReverseStyle = "bold" | "italic" | "boldItalic" | "strike" | "underline";

interface ReverseCharacter {
  text: string;
  style: Exclude<ReverseStyle, "strike" | "underline">;
}

interface StyledToken {
  text: string;
  style: ReverseStyle | null;
}

interface LetterRange {
  uppercaseBase: number;
  lowercaseBase: number;
  style: Exclude<ReverseStyle, "strike" | "underline">;
}

const MATHEMATICAL_LETTER_RANGES: LetterRange[] = [
  { uppercaseBase: 0x1d400, lowercaseBase: 0x1d41a, style: "bold" },
  { uppercaseBase: 0x1d434, lowercaseBase: 0x1d44e, style: "italic" },
  { uppercaseBase: 0x1d468, lowercaseBase: 0x1d482, style: "boldItalic" },
  { uppercaseBase: 0x1d5d4, lowercaseBase: 0x1d5ee, style: "bold" },
  { uppercaseBase: 0x1d608, lowercaseBase: 0x1d622, style: "italic" },
  { uppercaseBase: 0x1d63c, lowercaseBase: 0x1d656, style: "boldItalic" },
];

function addLetterRange(reverse: Map<string, ReverseCharacter>, range: LetterRange) {
  const uppercaseStart = "A".codePointAt(0) ?? 65;
  const lowercaseStart = "a".codePointAt(0) ?? 97;

  for (let offset = 0; offset < 26; offset += 1) {
    reverse.set(String.fromCodePoint(range.uppercaseBase + offset), {
      text: String.fromCodePoint(uppercaseStart + offset),
      style: range.style,
    });
    reverse.set(String.fromCodePoint(range.lowercaseBase + offset), {
      text: String.fromCodePoint(lowercaseStart + offset),
      style: range.style,
    });
  }
}

function buildReverseMap() {
  const reverse = new Map<string, ReverseCharacter>();
  const styles = ["bold", "italic", "boldItalic"] as const;

  for (const style of styles) {
    const styledLetters = Array.from(
      stylizeLinkedInCharacters(ASCII_LETTERS, style),
    );
    const plainLetters = Array.from(ASCII_LETTERS);

    styledLetters.forEach((styled, index) => {
      reverse.set(styled, {
        text: plainLetters[index],
        style,
      });
    });
  }

  MATHEMATICAL_LETTER_RANGES.forEach((range) => addLetterRange(reverse, range));

  return reverse;
}

const REVERSE_MATHEMATICAL_LETTERS = buildReverseMap();

function applySuppressedStyle(
  style: ReverseStyle,
  suppressedStyles: ReadonlySet<ReverseStyle>,
): ReverseStyle | null {
  if (style === "boldItalic") {
    const suppressBold =
      suppressedStyles.has("bold") || suppressedStyles.has("boldItalic");
    const suppressItalic =
      suppressedStyles.has("italic") || suppressedStyles.has("boldItalic");

    if (suppressBold && suppressItalic) return null;
    if (suppressBold) return "italic";
    if (suppressItalic) return "bold";
    return style;
  }

  return suppressedStyles.has(style) ? null : style;
}

function markdownMarkersForStyle(style: ReverseStyle) {
  if (style === "bold") return "**";
  if (style === "italic") return "*";
  if (style === "boldItalic") return "***";
  if (style === "strike") return "~~";
  return "";
}

function normalizeNeutralRuns(tokens: StyledToken[]) {
  return tokens.map((token, index) => {
    if (token.style !== null || !/^[\t ]+$/.test(token.text)) {
      return token;
    }

    const previous = tokens[index - 1]?.style ?? null;
    const next = tokens[index + 1]?.style ?? null;

    if (previous !== null && previous === next) {
      return { ...token, style: previous };
    }

    return token;
  });
}

function renderStyledTokens(tokens: StyledToken[]) {
  let output = "";
  let activeStyle: ReverseStyle | null = null;

  for (const token of tokens) {
    const nextStyle = token.style === "underline" ? null : token.style;

    if (activeStyle !== nextStyle) {
      if (activeStyle !== null) {
        output += markdownMarkersForStyle(activeStyle);
      }
      if (nextStyle !== null) {
        output += markdownMarkersForStyle(nextStyle);
      }
      activeStyle = nextStyle;
    }

    output += token.text;
  }

  if (activeStyle !== null) {
    output += markdownMarkersForStyle(activeStyle);
  }

  return output;
}

export function convertLinkedInUnicodeToMarkdown(
  text: string,
  suppressedStyles: ReadonlySet<ReverseStyle> = new Set(),
) {
  const chars = Array.from(text);
  const tokens: StyledToken[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (char === COMBINING_STRIKE || char === COMBINING_UNDERLINE) {
      continue;
    }

    const reversed = REVERSE_MATHEMATICAL_LETTERS.get(char);
    let token: StyledToken = reversed
      ? {
          text: reversed.text,
          style: applySuppressedStyle(reversed.style, suppressedStyles),
        }
      : { text: char, style: null };

    let lookahead = index + 1;
    let hasStrike = false;
    let hasUnderline = false;

    while (
      chars[lookahead] === COMBINING_STRIKE ||
      chars[lookahead] === COMBINING_UNDERLINE
    ) {
      hasStrike ||= chars[lookahead] === COMBINING_STRIKE;
      hasUnderline ||= chars[lookahead] === COMBINING_UNDERLINE;
      lookahead += 1;
    }

    if (hasStrike) {
      token = {
        text: token.text,
        style: applySuppressedStyle("strike", suppressedStyles),
      };
    } else if (hasUnderline) {
      token = {
        text: token.text,
        style: applySuppressedStyle("underline", suppressedStyles),
      };
    }

    tokens.push(token);
    index = lookahead - 1;
  }

  return renderStyledTokens(normalizeNeutralRuns(tokens));
}

export function convertLinkedInUnicodeInMarkdown(markdown: string) {
  let output = "";
  let buffer = "";
  let boldActive = false;
  let italicActive = false;
  let strikeActive = false;

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    const suppressedStyles = new Set<ReverseStyle>();
    if (boldActive) suppressedStyles.add("bold");
    if (italicActive) suppressedStyles.add("italic");
    if (strikeActive) suppressedStyles.add("strike");

    output += convertLinkedInUnicodeToMarkdown(buffer, suppressedStyles);
    buffer = "";
  };

  const rawSpanEnd = (startIndex: number, closingMarker: string) => {
    for (let index = startIndex; index < markdown.length; index += 1) {
      if (markdown[index] === "\\" && index + 1 < markdown.length) {
        index += 1;
        continue;
      }

      if (markdown.startsWith(closingMarker, index)) {
        return index + closingMarker.length;
      }
    }

    return startIndex;
  };

  const codeSpanEnd = (startIndex: number, closingMarker: string) => {
    for (let index = startIndex; index < markdown.length; index += 1) {
      if (markdown[index] === "\\" && index + 1 < markdown.length) {
        index += 1;
        continue;
      }

      if (markdown[index] !== "`") {
        continue;
      }

      const backtickRun = markdown.slice(index).match(/^`+/)?.[0] ?? "";
      if (backtickRun.length === closingMarker.length) {
        return index + backtickRun.length;
      }

      index += backtickRun.length - 1;
    }

    return startIndex;
  };

  const linkDestinationEnd = (startIndex: number) => {
    let nestedParens = 0;

    for (let index = startIndex; index < markdown.length; index += 1) {
      if (markdown[index] === "\\" && index + 1 < markdown.length) {
        index += 1;
        continue;
      }

      if (markdown[index] === "(") {
        nestedParens += 1;
        continue;
      }

      if (markdown[index] === ")") {
        if (nestedParens === 0) {
          return index + 1;
        }
        nestedParens -= 1;
      }
    }

    return startIndex;
  };

  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\\" && index + 1 < markdown.length) {
      buffer += markdown.slice(index, index + 2);
      index += 1;
      continue;
    }

    const backtickRun =
      markdown[index] === "`" ? (markdown.slice(index).match(/^`+/)?.[0] ?? "") : "";
    const codeMarker = backtickRun.length > 0 ? backtickRun : "";

    if (codeMarker.length > 0) {
      flushBuffer();
      const endIndex = codeSpanEnd(index + codeMarker.length, codeMarker);
      output += markdown.slice(index, endIndex);
      index = endIndex - 1;
      continue;
    }

    if (markdown.startsWith("](", index)) {
      flushBuffer();
      const endIndex = linkDestinationEnd(index + 2);
      output += markdown.slice(index, endIndex);
      index = endIndex - 1;
      continue;
    }

    if (markdown.startsWith("<http", index) || markdown.startsWith("<mailto:", index)) {
      flushBuffer();
      const endIndex = rawSpanEnd(index + 1, ">");
      output += markdown.slice(index, endIndex);
      index = endIndex - 1;
      continue;
    }

    const marker = markdown.startsWith("***", index)
      ? "***"
      : markdown.startsWith("**", index) || markdown.startsWith("__", index)
        ? markdown.slice(index, index + 2)
        : markdown.startsWith("~~", index)
          ? "~~"
          : markdown[index] === "*" || markdown[index] === "_"
            ? markdown[index]
            : "";

    if (marker.length === 0) {
      buffer += markdown[index];
      continue;
    }

    flushBuffer();
    output += marker;

    if (marker === "***") {
      boldActive = !boldActive;
      italicActive = !italicActive;
    } else if (marker === "**" || marker === "__") {
      boldActive = !boldActive;
    } else if (marker === "~~") {
      strikeActive = !strikeActive;
    } else {
      italicActive = !italicActive;
    }

    index += marker.length - 1;
  }

  flushBuffer();
  return output;
}

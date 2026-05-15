import { convertHtmlFragmentToMarkdown } from "../../converters/richText";
import { stylizeLinkedInCharacters } from "../linkedinFormatting";

const ASCII_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const COMBINING_STRIKE = "\u0336";
const COMBINING_UNDERLINE = "\u0332";

type PasteSource = "html" | "plainText" | "empty";
type ReverseStyle = "bold" | "italic" | "boldItalic" | "strike" | "underline";

export interface ClipboardPasteInput {
  html: string;
  plainText: string;
}

export interface ClipboardPasteConversion {
  markdown: string;
  source: PasteSource;
}

interface ReverseCharacter {
  text: string;
  style: Exclude<ReverseStyle, "strike" | "underline">;
}

interface StyledToken {
  text: string;
  style: ReverseStyle | null;
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

  return reverse;
}

const REVERSE_MATHEMATICAL_LETTERS = buildReverseMap();

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

export function convertLinkedInUnicodeToMarkdown(text: string) {
  const chars = Array.from(text);
  const tokens: StyledToken[] = [];

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (char === COMBINING_STRIKE || char === COMBINING_UNDERLINE) {
      continue;
    }

    const reversed = REVERSE_MATHEMATICAL_LETTERS.get(char);
    let token: StyledToken = reversed
      ? { text: reversed.text, style: reversed.style }
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
      token = { text: token.text, style: "strike" };
    } else if (hasUnderline) {
      token = { text: token.text, style: "underline" };
    }

    tokens.push(token);
    index = lookahead - 1;
  }

  return renderStyledTokens(normalizeNeutralRuns(tokens));
}

export function convertClipboardPasteToMarkdown({
  html,
  plainText,
}: ClipboardPasteInput): ClipboardPasteConversion {
  if (html.trim().length > 0) {
    const htmlMarkdown = convertHtmlFragmentToMarkdown(html);

    if (htmlMarkdown.trim().length > 0) {
      return {
        markdown: convertLinkedInUnicodeToMarkdown(htmlMarkdown),
        source: "html",
      };
    }
  }

  if (plainText.length === 0) {
    return {
      markdown: "",
      source: "empty",
    };
  }

  return {
    markdown: convertLinkedInUnicodeToMarkdown(plainText),
    source: "plainText",
  };
}

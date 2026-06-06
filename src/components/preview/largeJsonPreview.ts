export const LARGE_JSON_MARKDOWN_THRESHOLD = 250_000;
export const LARGE_JSON_PREVIEW_CHARACTER_LIMIT = 200_000;

const JSON_FENCE_PREFIX = "```json\n";
const FENCE_SUFFIX = "\n```";

export type LargeJsonPreviewState = {
  previewText: string;
  totalCharacters: number;
  shownCharacters: number;
};

export function getLargeJsonPreview(
  markdown: string,
): LargeJsonPreviewState | null {
  if (
    markdown.length < LARGE_JSON_MARKDOWN_THRESHOLD ||
    !markdown.startsWith(JSON_FENCE_PREFIX) ||
    !markdown.endsWith(FENCE_SUFFIX)
  ) {
    return null;
  }

  const bodyStart = JSON_FENCE_PREFIX.length;
  const bodyEnd = markdown.length - FENCE_SUFFIX.length;
  const bodyLength = bodyEnd - bodyStart;
  const shownCharacters = Math.min(
    bodyLength,
    LARGE_JSON_PREVIEW_CHARACTER_LIMIT,
  );
  const previewBody = markdown.slice(bodyStart, bodyStart + shownCharacters);
  const omittedCharacters = bodyLength - shownCharacters;
  const omittedNotice =
    omittedCharacters > 0
      ? `\n\n... ${omittedCharacters.toLocaleString()} characters omitted from preview ...`
      : "";

  return {
    previewText: `${previewBody}${omittedNotice}`,
    totalCharacters: bodyLength,
    shownCharacters,
  };
}

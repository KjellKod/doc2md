const TASK_MARKER_PATTERN = /^(\s*(?:(?:[-*+]|\d+[.)])\s+)+\[)(?: |x|X)(\]\s*)/u;

export function replaceTaskMarkerAtSourceLine(
  markdown: string,
  sourceLine: number,
  checked: boolean,
) {
  if (!Number.isInteger(sourceLine) || sourceLine < 1) {
    return markdown;
  }

  const segments = markdown.split(/(\r\n|\n|\r)/u);
  const segmentIndex = (sourceLine - 1) * 2;
  const line = segments[segmentIndex];

  if (line === undefined) {
    return markdown;
  }

  const nextLine = line.replace(
    TASK_MARKER_PATTERN,
    `$1${checked ? "x" : " "}$2`,
  );

  if (nextLine === line) {
    return markdown;
  }

  segments[segmentIndex] = nextLine;
  return segments.join("");
}

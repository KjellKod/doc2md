import { toggleRowMarkerByIndex } from "./tableCellCheckbox";

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

// SEPARATE table-cell write-back. Kept independent from
// replaceTaskMarkerAtSourceLine on purpose: the list path supports ordered
// markers (1)/1.) that the table path deliberately omits, so collapsing them
// would regress ordered task-list toggles (plan §4.2, finding arb-it1-1).
// Dispatched by the data-task-marker-index attribute presence in PreviewMode.
export function replaceTaskMarkerByIndex(
  markdown: string,
  sourceLine: number,
  markerIndex: number,
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

  const nextLine = toggleRowMarkerByIndex(line, markerIndex, checked);

  if (nextLine === line) {
    return markdown;
  }

  segments[segmentIndex] = nextLine;
  return segments.join("");
}

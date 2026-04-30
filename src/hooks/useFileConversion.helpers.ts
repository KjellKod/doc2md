import { getFileExtension } from "../converters";
import { CORRUPT_FILE_MESSAGE, TIMEOUT_MESSAGE } from "../converters/messages";
import type { ConversionResult } from "../converters/types";
import type { FileEntry } from "../types";
import type { ShellOpenOk } from "../types/doc2mdShell";

export function createEntryId(
  fileName: string,
  index: number,
  now = Date.now(),
  random = Math.round(Math.random() * 1_000_000),
) {
  const normalizedName = fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return `${normalizedName}-${now}-${index}-${random}`;
}

export function createPendingEntry(
  file: File,
  index: number,
  selected: boolean,
): FileEntry {
  const extension = getFileExtension(file.name);

  return {
    id: createEntryId(file.name, index),
    file,
    name: file.name,
    format: extension || "unknown",
    status: "pending",
    markdown: "",
    warnings: [],
    selected,
  };
}

export function createPendingEntries(files: File[], hasSelection: boolean) {
  return files.map((file, index) =>
    createPendingEntry(file, index, !hasSelection && index === 0),
  );
}

export function createScratchEntry(name = "Untitled.md"): FileEntry {
  return {
    id: createEntryId(name, 0),
    file: new File([], name, { type: "text/markdown" }),
    name,
    format: "md",
    status: "success",
    markdown: "",
    editedMarkdown: "",
    warnings: [],
    selected: true,
    isScratch: true,
  };
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || "Untitled.md";
}

function suggestedMarkdownName(name: string) {
  const basenameWithoutExtension = name.replace(/\.[^.]+$/u, "");
  const safeBasename = basenameWithoutExtension || name || "Untitled";

  return safeBasename.toLowerCase().endsWith(".md")
    ? safeBasename
    : `${safeBasename}.md`;
}

export function createDesktopMarkdownEntry(
  openedFile: ShellOpenOk,
): FileEntry {
  const name = basename(openedFile.path);
  const extension = getFileExtension(name) || "md";

  return {
    id: createEntryId(name, 0),
    file: new File([openedFile.content], name, { type: "text/markdown" }),
    name,
    format: extension,
    status: "success",
    markdown: openedFile.content,
    editedMarkdown: openedFile.content,
    warnings: [],
    selected: true,
    desktopFile: {
      path: openedFile.path,
      mtimeMs: openedFile.mtimeMs,
      lineEnding: openedFile.lineEnding,
    },
  };
}

export function createImportedEntry(
  file: File,
  sourceMeta: {
    path: string;
    format: string;
    mtimeMs: number;
  },
): FileEntry {
  const name = suggestedMarkdownName(file.name);

  return {
    id: createEntryId(file.name, 0),
    file,
    name,
    format: "md",
    status: "pending",
    markdown: "",
    warnings: [],
    selected: true,
    sourceMeta,
  };
}

export function replaceEntryWithDesktopMarkdown(
  entry: FileEntry,
  openedFile: ShellOpenOk,
): FileEntry {
  const name = basename(openedFile.path);
  const extension = getFileExtension(name) || "md";

  return {
    ...entry,
    file: new File([openedFile.content], name, { type: "text/markdown" }),
    name,
    format: extension,
    status: "success",
    markdown: openedFile.content,
    editedMarkdown: openedFile.content,
    warnings: [],
    quality: undefined,
    isScratch: false,
    desktopFile: {
      path: openedFile.path,
      mtimeMs: openedFile.mtimeMs,
      lineEnding: openedFile.lineEnding,
    },
  };
}

export function markEntryConverting(entry: FileEntry): FileEntry {
  return {
    ...entry,
    status: "converting",
    warnings: [],
    quality: undefined,
  };
}

export function applyConversionResult(
  entry: FileEntry,
  result: ConversionResult,
): FileEntry {
  return {
    ...entry,
    markdown: result.markdown,
    warnings: result.warnings,
    status: result.status,
    quality: result.quality,
  };
}

export function getConversionFailureWarning(
  error: unknown,
  timeoutError: Error,
) {
  return error === timeoutError ? TIMEOUT_MESSAGE : CORRUPT_FILE_MESSAGE;
}

export function markEntryError(entry: FileEntry, warning: string): FileEntry {
  return {
    ...entry,
    markdown: "",
    warnings: [warning],
    status: "error",
    quality: undefined,
  };
}

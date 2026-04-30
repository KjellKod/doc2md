import { useRef, useState } from "react";
import { convertFile, getFileExtension } from "../converters";
import {
  CONVERSION_TIMEOUT_MS,
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import type { FileEntry } from "../types";
import type { ShellLineEnding, ShellOpenOk } from "../types/doc2mdShell";
import { downloadRemoteDocument } from "../utils/remoteDocument";
import {
  applyConversionResult,
  createImportedEntry,
  createDesktopMarkdownEntry,
  createScratchEntry,
  createPendingEntries,
  getConversionFailureWarning,
  markEntryConverting,
  markEntryError,
  replaceEntryWithDesktopMarkdown,
} from "./useFileConversion.helpers";

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || "Untitled.md";
}

function scratchNameAt(index: number) {
  return index === 1 ? "Untitled.md" : `Untitled ${index}.md`;
}

function nextScratchName(scratchNames: string[]) {
  const usedNames = new Set(scratchNames.map((name) => name.toLowerCase()));

  let index = 1;
  while (usedNames.has(scratchNameAt(index).toLowerCase())) {
    index += 1;
  }

  return scratchNameAt(index);
}

export function useFileConversion() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const scratchNamesRef = useRef<string[]>([]);
  scratchNamesRef.current = entries
    .filter((entry) => entry.isScratch && !entry.desktopFile)
    .map((entry) => entry.name);

  function updateEntry(id: string, updater: (entry: FileEntry) => FileEntry) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) => (entry.id === id ? updater(entry) : entry)),
    );
  }

  async function processEntry(entry: FileEntry) {
    if (entry.file.size > MAX_BROWSER_FILE_SIZE_BYTES) {
      updateEntry(entry.id, (currentEntry) =>
        markEntryError(currentEntry, OVERSIZED_FILE_MESSAGE),
      );
      return;
    }

    updateEntry(entry.id, markEntryConverting);

    const timeoutError = new Error("conversion-timeout");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(timeoutError),
          CONVERSION_TIMEOUT_MS,
        );
      });
      const result = await Promise.race([
        convertFile(entry.file),
        timeoutPromise,
      ]);

      updateEntry(entry.id, (currentEntry) =>
        applyConversionResult(currentEntry, result),
      );
    } catch (error) {
      updateEntry(entry.id, (currentEntry) =>
        markEntryError(
          currentEntry,
          getConversionFailureWarning(error, timeoutError),
        ),
      );
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function processWithConcurrencyLimit(
    entriesToProcess: FileEntry[],
    limit: number,
  ) {
    const queue = [...entriesToProcess];
    const active: Promise<void>[] = [];

    while (queue.length > 0 || active.length > 0) {
      while (active.length < limit && queue.length > 0) {
        const entry = queue.shift()!;
        const promise = processEntry(entry).then(() => {
          active.splice(active.indexOf(promise), 1);
        });
        active.push(promise);
      }

      if (active.length > 0) {
        await Promise.race(active);
      }
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    const hasSelection = entries.some((entry) => entry.selected);
    const nextEntries = createPendingEntries(files, hasSelection);

    setEntries((currentEntries) => [...currentEntries, ...nextEntries]);

    void processWithConcurrencyLimit(nextEntries, 3);
  }

  async function addUrl(url: string) {
    const file = await downloadRemoteDocument(url);
    addFiles([file]);
  }

  function addScratchEntry() {
    const scratchName = nextScratchName(scratchNamesRef.current);
    scratchNamesRef.current = [...scratchNamesRef.current, scratchName];
    const scratchEntry = createScratchEntry(scratchName);
    setEntries((currentEntries) => {
      return [
        ...currentEntries.map((entry) => ({
          ...entry,
          selected: false,
        })),
        scratchEntry,
      ];
    });

    return scratchEntry.id;
  }

  function addOpenedFileEntry(openedFile: ShellOpenOk) {
    const openedEntry = createDesktopMarkdownEntry(openedFile);
    setEntries((currentEntries) => [
      ...currentEntries.map((entry) => ({
        ...entry,
        selected: false,
      })),
      openedEntry,
    ]);

    return openedEntry.id;
  }

  function addImportedFileEntry(args: {
    file: File;
    path: string;
    mtimeMs: number;
    sourceFormat: string;
  }) {
    const importedEntry = createImportedEntry(args.file, {
      path: args.path,
      format: args.sourceFormat,
      mtimeMs: args.mtimeMs,
    });

    setEntries((currentEntries) => [
      ...currentEntries.map((entry) => ({
        ...entry,
        selected: false,
      })),
      importedEntry,
    ]);

    void processEntry(importedEntry);

    return importedEntry.id;
  }

  function replaceEntryWithOpenedFile(entryId: string, openedFile: ShellOpenOk) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? replaceEntryWithDesktopMarkdown(entry, openedFile)
          : entry,
      ),
    );
  }

  function updateEntryDesktopFile(
    entryId: string,
    metadata: {
      path: string;
      mtimeMs: number;
      lineEnding: ShellLineEnding;
    },
  ) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              file: new File([entry.editedMarkdown ?? entry.markdown], basename(metadata.path), {
                type: "text/markdown",
              }),
              name: basename(metadata.path),
              format: getFileExtension(basename(metadata.path)) || entry.format,
              isScratch: false,
              desktopFile: metadata,
            }
          : entry,
      ),
    );
  }

  function selectEntry(id: string) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) => ({
        ...entry,
        selected: entry.id === id,
      })),
    );
  }

  function clearEntries() {
    setEntries([]);
  }

  function updateMarkdown(id: string, markdown: string) {
    updateEntry(id, (entry) => ({ ...entry, editedMarkdown: markdown }));
  }

  const selectedEntry = entries.find((entry) => entry.selected) ?? null;

  return {
    entries,
    addFiles,
    addUrl,
    addScratchEntry,
    addOpenedFileEntry,
    addImportedFileEntry,
    clearEntries,
    replaceEntryWithOpenedFile,
    selectEntry,
    selectedEntry,
    updateEntryDesktopFile,
    updateMarkdown,
  };
}

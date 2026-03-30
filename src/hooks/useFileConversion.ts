import { useState } from "react";
import { convertFile } from "../converters";
import {
  CONVERSION_TIMEOUT_MS,
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import type { FileEntry } from "../types";
import {
  applyConversionResult,
  createScratchEntry,
  createPendingEntries,
  getConversionFailureWarning,
  markEntryConverting,
  markEntryError,
} from "./useFileConversion.helpers";

export function useFileConversion() {
  const [entries, setEntries] = useState<FileEntry[]>([]);

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

    let nextEntries: FileEntry[] = [];

    setEntries((currentEntries) => {
      const hasSelection = currentEntries.some((entry) => entry.selected);

      nextEntries = createPendingEntries(files, hasSelection);

      return [...currentEntries, ...nextEntries];
    });

    void processWithConcurrencyLimit(nextEntries, 3);
  }

  function addScratchEntry() {
    setEntries((currentEntries) => [
      ...currentEntries.map((entry) => ({
        ...entry,
        selected: false,
      })),
      createScratchEntry(),
    ]);
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
    addScratchEntry,
    clearEntries,
    selectEntry,
    selectedEntry,
    updateMarkdown,
  };
}

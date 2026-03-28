import { useState } from "react";
import { convertFile, getFileExtension } from "../converters";
import type { FileEntry } from "../types";

function createEntryId(file: File, index: number) {
  const normalizedName = file.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return `${normalizedName}-${Date.now()}-${index}-${Math.round(Math.random() * 1_000_000)}`;
}

function createPendingEntry(file: File, index: number, selected: boolean): FileEntry {
  const extension = getFileExtension(file.name);

  return {
    id: createEntryId(file, index),
    file,
    name: file.name,
    format: extension || "unknown",
    status: "pending",
    markdown: "",
    warnings: [],
    selected
  };
}

export function useFileConversion() {
  const [entries, setEntries] = useState<FileEntry[]>([]);

  function updateEntry(id: string, updater: (entry: FileEntry) => FileEntry) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) => (entry.id === id ? updater(entry) : entry))
    );
  }

  async function processEntry(entry: FileEntry) {
    updateEntry(entry.id, (currentEntry) => ({
      ...currentEntry,
      status: "converting",
      warnings: []
    }));

    try {
      const result = await convertFile(entry.file);

      updateEntry(entry.id, (currentEntry) => ({
        ...currentEntry,
        markdown: result.markdown,
        warnings: result.warnings,
        status: result.status
      }));
    } catch {
      updateEntry(entry.id, (currentEntry) => ({
        ...currentEntry,
        markdown: "",
        warnings: ["This file could not be converted."],
        status: "error"
      }));
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

      nextEntries = files.map((file, index) =>
        createPendingEntry(file, index, !hasSelection && index === 0)
      );

      return [...currentEntries, ...nextEntries];
    });

    nextEntries.forEach((entry) => {
      void processEntry(entry);
    });
  }

  function selectEntry(id: string) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) => ({
        ...entry,
        selected: entry.id === id
      }))
    );
  }

  const selectedEntry = entries.find((entry) => entry.selected) ?? null;

  return {
    entries,
    addFiles,
    selectEntry,
    selectedEntry
  };
}

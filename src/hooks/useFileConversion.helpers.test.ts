import { describe, expect, it } from "vitest";
import {
  OVERSIZED_FILE_MESSAGE,
  TIMEOUT_MESSAGE,
} from "../converters/messages";
import type { FileEntry } from "../types";
import {
  applyConversionResult,
  createImportedEntry,
  createEntryId,
  createPendingEntries,
  createPendingEntry,
  createScratchEntry,
  getConversionFailureWarning,
  markEntryConverting,
  markEntryError,
} from "./useFileConversion.helpers";

function createFile(name: string) {
  return new File(["content"], name, { type: "text/plain" });
}

function createEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "entry-1",
    file: createFile("sample.txt"),
    name: "sample.txt",
    format: "txt",
    status: "pending",
    markdown: "",
    warnings: [],
    selected: true,
    ...overrides,
  };
}

describe("useFileConversion helpers", () => {
  it("creates stable entry ids from normalized file names when seeds are provided", () => {
    expect(createEntryId("Quarterly Report (Final).DOCX", 2, 1234, 42)).toBe(
      "quarterly-report-final-docx-1234-2-42",
    );
  });

  it("creates pending entries with the file extension and selected state", () => {
    expect(createPendingEntry(createFile("notes.md"), 0, true)).toMatchObject({
      name: "notes.md",
      format: "md",
      status: "pending",
      selected: true,
    });
  });

  it("selects the first new pending entry only when there is no existing selection", () => {
    expect(
      createPendingEntries(
        [createFile("alpha.txt"), createFile("beta.txt")],
        false,
      ).map((entry) => entry.selected),
    ).toEqual([true, false]);

    expect(
      createPendingEntries(
        [createFile("alpha.txt"), createFile("beta.txt")],
        true,
      ).map((entry) => entry.selected),
    ).toEqual([false, false]);
  });

  it("creates a scratch entry ready for editing", () => {
    expect(createScratchEntry()).toMatchObject({
      name: "Untitled.md",
      format: "md",
      status: "success",
      markdown: "",
      editedMarkdown: "",
      warnings: [],
      selected: true,
      isScratch: true,
    });
  });

  it("creates imported entries with a markdown save suggestion and source metadata", () => {
    expect(
      createImportedEntry(createFile("meeting-notes.txt"), {
        path: "/Users/me/meeting-notes.txt",
        format: "txt",
        mtimeMs: 42,
      }),
    ).toMatchObject({
      file: expect.objectContaining({ name: "meeting-notes.txt" }),
      name: "meeting-notes.md",
      format: "md",
      status: "pending",
      selected: true,
      sourceMeta: {
        path: "/Users/me/meeting-notes.txt",
        format: "txt",
        mtimeMs: 42,
      },
    });
  });

  it("marks entries as converting and clears warnings", () => {
    expect(
      markEntryConverting(
        createEntry({
          status: "pending",
          warnings: ["old warning"],
          quality: {
            level: "good",
            summary: "Good: Selectable text detected. Layout looks straightforward.",
          },
        }),
      ),
    ).toMatchObject({
      status: "converting",
      warnings: [],
      quality: undefined,
    });
  });

  it("applies conversion results to the entry", () => {
    expect(
      applyConversionResult(createEntry(), {
        markdown: "# Converted",
        warnings: ["review this"],
        status: "warning",
        quality: {
          level: "review",
          summary:
            "Review: Text was extracted, but layout may be fragmented or out of reading order.",
        },
      }),
    ).toMatchObject({
      markdown: "# Converted",
      warnings: ["review this"],
      status: "warning",
      quality: {
        level: "review",
        summary:
          "Review: Text was extracted, but layout may be fragmented or out of reading order.",
      },
    });
  });

  it("maps timeout failures separately from generic conversion failures", () => {
    const timeoutError = new Error("timeout");

    expect(getConversionFailureWarning(timeoutError, timeoutError)).toBe(
      TIMEOUT_MESSAGE,
    );
    expect(getConversionFailureWarning(new Error("bad"), timeoutError)).toBe(
      "We couldn't read this file. It may be corrupted or use a structure not supported by this tool.",
    );
  });

  it("marks entries as failed with the provided warning", () => {
    expect(
      markEntryError(
        createEntry({
          markdown: "# Old",
          quality: {
            level: "poor",
            summary:
              "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
          },
        }),
        OVERSIZED_FILE_MESSAGE,
      ),
    ).toEqual({
      ...createEntry({ markdown: "# Old" }),
      markdown: "",
      warnings: [OVERSIZED_FILE_MESSAGE],
      status: "error",
      quality: undefined,
    });
  });
});

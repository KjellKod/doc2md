import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORRUPT_FILE_MESSAGE,
  CONVERSION_TIMEOUT_MS,
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
  TIMEOUT_MESSAGE,
} from "../converters/messages";
import {
  REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE,
  REMOTE_DOCUMENT_TIMEOUT_MESSAGE,
} from "../utils/remoteDocument";
import { useFileConversion } from "./useFileConversion";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

vi.mock("../converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

function createSuccessResult(markdown: string) {
  return {
    markdown,
    warnings: [],
    status: "success" as const,
  };
}

function createFile(name: string) {
  return new File(["content"], name, { type: "text/plain" });
}

function createOversizedFile(name: string) {
  const file = createFile(name);

  Object.defineProperty(file, "size", {
    value: MAX_BROWSER_FILE_SIZE_BYTES + 1,
  });

  return file;
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFileConversion", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sets error with timeout message when a converter hangs", async () => {
    vi.useFakeTimers();
    convertFileMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("hung.txt")]);
    });

    await flushUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);
  });

  it("completes normally when a converter resolves before timeout", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("fast.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("success");
      expect(result.current.entries[0]?.markdown).toBe("# Converted");
    });
  });

  it("maps non-timeout conversion failures to the corrupt file message", async () => {
    convertFileMock.mockRejectedValue(new Error("corrupt"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("broken.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("error");
      expect(result.current.entries[0]?.warnings).toEqual([
        CORRUPT_FILE_MESSAGE,
      ]);
    });
  });

  it("marks oversized files without calling the converter", async () => {
    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createOversizedFile("huge.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("error");
      expect(result.current.entries[0]?.warnings).toEqual([
        OVERSIZED_FILE_MESSAGE,
      ]);
    });

    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it("selects the first added entry and lets users switch selection", async () => {
    convertFileMock.mockImplementation((file: File) =>
      Promise.resolve(createSuccessResult(`# ${file.name}`)),
    );

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("first.txt"),
        createFile("second.txt"),
      ]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(result.current.entries[0]?.selected).toBe(true);
    expect(result.current.entries[1]?.selected).toBe(false);

    const secondEntryId = result.current.entries[1]!.id;

    act(() => {
      result.current.selectEntry(secondEntryId);
    });

    expect(result.current.entries[0]?.selected).toBe(false);
    expect(result.current.entries[1]?.selected).toBe(true);
    expect(result.current.selectedEntry?.id).toBe(secondEntryId);
  });

  it("updates edited markdown for the selected entry", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("editable.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    const entryId = result.current.entries[0]!.id;

    act(() => {
      result.current.updateMarkdown(entryId, "# Edited");
    });

    expect(result.current.entries[0]?.editedMarkdown).toBe("# Edited");
  });

  it("creates a selected scratch entry without uploading a file", () => {
    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addScratchEntry();
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toMatchObject({
      name: "Untitled.md",
      format: "md",
      status: "success",
      markdown: "",
      editedMarkdown: "",
      selected: true,
      isScratch: true,
    });
    expect(result.current.selectedEntry?.id).toBe(
      result.current.entries[0]?.id,
    );
  });

  it("selects the scratch entry even when another file is already selected", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("existing.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    act(() => {
      result.current.addScratchEntry();
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]?.selected).toBe(false);
    expect(result.current.entries[1]).toMatchObject({
      name: "Untitled.md",
      selected: true,
      isScratch: true,
    });
    expect(result.current.selectedEntry?.id).toBe(
      result.current.entries[1]?.id,
    );
  });

  it("adds uniquely named scratch entries without removing existing entries", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("existing.txt"),
        createFile("second.txt"),
      ]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    act(() => {
      result.current.updateMarkdown(result.current.entries[0]!.id, "# Edited");
      result.current.addScratchEntry();
    });

    expect(result.current.entries).toHaveLength(3);
    expect(result.current.entries[0]).toMatchObject({
      name: "existing.txt",
      editedMarkdown: "# Edited",
      selected: false,
    });
    expect(result.current.entries[1]).toMatchObject({
      name: "second.txt",
      selected: false,
    });
    expect(result.current.entries[2]).toMatchObject({
      name: "Untitled.md",
      format: "md",
      status: "success",
      markdown: "",
      editedMarkdown: "",
      selected: true,
      isScratch: true,
    });
    expect(result.current.selectedEntry?.id).toBe(
      result.current.entries[2]?.id,
    );
  });

  it("reuses the lowest available untitled number after a scratch entry is saved", () => {
    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addScratchEntry();
    });
    act(() => {
      result.current.addScratchEntry();
    });

    expect(result.current.entries.map((entry) => entry.name)).toEqual([
      "Untitled.md",
      "Untitled 2.md",
    ]);

    act(() => {
      result.current.renameEntry(result.current.entries[1]!.id, "Notes.md");
    });
    act(() => {
      result.current.addScratchEntry();
    });

    expect(result.current.entries.map((entry) => entry.name)).toEqual([
      "Untitled.md",
      "Notes.md",
      "Untitled 2.md",
    ]);
  });

  it("clears all entries and resets the selection", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("clear-me.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    act(() => {
      result.current.clearEntries();
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.selectedEntry).toBeNull();
  });

  it("clears entries by id and selects the next remaining entry", async () => {
    convertFileMock.mockImplementation((file: File) =>
      Promise.resolve(createSuccessResult(`# ${file.name}`)),
    );

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("alpha.txt"),
        createFile("beta.txt"),
        createFile("gamma.txt"),
      ]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    const [alpha, beta, gamma] = result.current.entries;

    act(() => {
      result.current.clearEntriesById([alpha!.id, gamma!.id]);
    });

    expect(result.current.entries.map((entry) => entry.id)).toEqual([beta!.id]);
    expect(result.current.selectedEntry?.id).toBe(beta!.id);
  });

  it("clears active last entry by id and selects the previous remaining entry", async () => {
    convertFileMock.mockImplementation((file: File) =>
      Promise.resolve(createSuccessResult(`# ${file.name}`)),
    );

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("alpha.txt"), createFile("beta.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    const [alpha, beta] = result.current.entries;

    act(() => {
      result.current.selectEntry(beta!.id);
    });
    act(() => {
      result.current.clearEntriesById([beta!.id]);
    });

    expect(result.current.entries.map((entry) => entry.id)).toEqual([alpha!.id]);
    expect(result.current.selectedEntry?.id).toBe(alpha!.id);
  });

  it("adds imported files through the shared conversion pipeline with a markdown save suggestion", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Imported"));

    const { result } = renderHook(() => useFileConversion());
    const file = new File(["hello"], "imported.txt", { type: "text/plain" });

    act(() => {
      result.current.addImportedFileEntry(file);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("success");
    });

    expect(convertFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "imported.txt" }),
    );
    expect(result.current.entries[0]).toMatchObject({
      name: "imported.md",
      format: "md",
    });
  });

  it("converts re-added files after clearing entries", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());
    const file = createFile("repro.pdf");

    act(() => {
      result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("success");
    });

    act(() => {
      result.current.clearEntries();
    });

    expect(result.current.entries).toEqual([]);

    act(() => {
      result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]?.status).toBe("success");
    });
  });

  it("discards late converter resolution after timeout", async () => {
    vi.useFakeTimers();

    let resolveConversion:
      | ((value: ReturnType<typeof createSuccessResult>) => void)
      | undefined;

    convertFileMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConversion = resolve;
        }),
    );

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("late.txt")]);
    });

    await flushUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);

    await act(async () => {
      resolveConversion?.(createSuccessResult("# Too Late"));
      await Promise.resolve();
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.markdown).toBe("");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);
  });

  it("does not let one hung converter block otherwise healthy queued files", async () => {
    convertFileMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(createSuccessResult("# Second"))
      .mockResolvedValueOnce(createSuccessResult("# Third"))
      .mockResolvedValueOnce(createSuccessResult("# Fourth"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("first.txt"),
        createFile("second.txt"),
        createFile("third.txt"),
        createFile("fourth.txt"),
      ]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("converting");
      expect(result.current.entries[1]?.status).toBe("success");
      expect(result.current.entries[2]?.status).toBe("success");
      expect(result.current.entries[3]?.status).toBe("success");
    });
  });

  it("lets queued files proceed once timed-out conversions free their slots", async () => {
    vi.useFakeTimers();

    convertFileMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(createSuccessResult("# Fourth"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("first.txt"),
        createFile("second.txt"),
        createFile("third.txt"),
        createFile("fourth.txt"),
      ]);
    });

    await flushUpdates();

    expect(result.current.entries).toHaveLength(4);
    expect(result.current.entries[3]?.status).toBe("pending");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[1]?.status).toBe("error");
    expect(result.current.entries[2]?.status).toBe("error");
    expect(result.current.entries[3]?.status).toBe("success");
  });

  it("downloads a remote URL and converts it like an uploaded file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-disposition": 'attachment; filename="remote-notes.txt"',
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["remote"], { type: "text/plain" })),
    });
    vi.stubGlobal("fetch", fetchMock);
    convertFileMock.mockResolvedValue(createSuccessResult("# Remote"));

    const { result } = renderHook(() => useFileConversion());

    await act(async () => {
      await result.current.addUrl("https://example.com/download?id=7");
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("success");
      expect(result.current.entries[0]?.name).toBe("remote-notes.txt");
      expect(result.current.entries[0]?.markdown).toBe("# Remote");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/download?id=7",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(convertFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "remote-notes.txt" }),
    );
  });

  it("surfaces remote download failures to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const { result } = renderHook(() => useFileConversion());

    await expect(
      result.current.addUrl("https://example.com/private.docx"),
    ).rejects.toThrow(REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE);
  });

  it("surfaces remote download timeouts to the caller", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }));

    const { result } = renderHook(() => useFileConversion());
    const pending = result.current.addUrl("https://example.com/slow.docx");
    const expectation = expect(pending).rejects.toThrow(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);

    await vi.advanceTimersByTimeAsync(30_000);

    await expectation;
  });
});

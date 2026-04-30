import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import {
  createMockImportShellFile,
  installMockShell,
} from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

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

function mockDoc2mdProtocol() {
  vi.stubGlobal("location", {
    ...window.location,
    protocol: "doc2md:",
  });
}

function mockOversizedImportedFileSize() {
  const NativeFile = File;

  class OversizedFile extends NativeFile {
    constructor(
      fileBits: BlobPart[],
      fileName: string,
      options?: FilePropertyBag,
    ) {
      super(fileBits, fileName, options);
      Object.defineProperty(this, "size", {
        configurable: true,
        value: MAX_BROWSER_FILE_SIZE_BYTES + 1,
      });
    }
  }

  vi.stubGlobal("File", OversizedFile);
}

describe("App desktop bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.doc2mdShell;
    cleanup();
  });

  it("renders no desktop-only DOM when window.doc2mdShell is absent", () => {
    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
  });

  it("gates desktop-only DOM when the shell version is incompatible", () => {
    const cleanupShell = installMockShell({ version: 2 });

    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();

    cleanupShell();
  });

  it("routes native New through the shared clean scratch reset", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const cleanupShell = installMockShell();

    render(<App />);

    expect(screen.getByTestId("desktop-menu-bridge")).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(
      await screen.findByRole("button", { name: /untitled\.md/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("starts a clean scratch from a saved desktop file without confirming", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Original.md",
      mtimeMs: 11,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/New.md",
      mtimeMs: 12,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Original.md",
        content: "# Original",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /original\.md/i });

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /original\.md/i })).toBeNull();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(editor).toHaveValue("");
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFile).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("cancels desktop New from a dirty file without discarding edits", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Dirty.md",
        content: "# Dirty",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /dirty\.md/i });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Dirty\n\nKeep this" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Edited",
      ),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /dirty\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit markdown")).toHaveValue(
      "# Dirty\n\nKeep this",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "/Users/me/Dirty.md",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Edited",
    );

    cleanupShell();
  });

  it("accepts desktop New from a dirty file and clears the saved path", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Dirty.md",
      mtimeMs: 11,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Untitled.md",
      mtimeMs: 12,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Dirty.md",
        content: "# Dirty",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /dirty\.md/i });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Dirty\n\nDiscard this" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Edited",
      ),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(editor).toHaveValue("");
    expect(screen.queryByRole("button", { name: /dirty\.md/i })).toBeNull();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFile).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("renders the desktop app-ready marker with visible title and save state", () => {
    const cleanupShell = installMockShell();

    render(<App />);

    expect(screen.getByLabelText("Desktop file status")).toHaveAttribute(
      "data-app-ready",
      "true",
    );
    expect(screen.getByText("Untitled.md")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    cleanupShell();
  });

  it("opens a native Markdown file and saves it with CRLF metadata", async () => {
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Notes.md",
      mtimeMs: 12,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Notes.md",
        content: "one\r\ntwo\r\n",
        mtimeMs: 10,
        lineEnding: "crlf" as const,
      })),
      saveFile,
    });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Notes.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "one\r\ntwo\r\nthree" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/Notes.md",
      content: "one\ntwo\nthree",
      expectedMtimeMs: 10,
      lineEnding: "crlf",
    });
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);

    cleanupShell();
  });

  it("routes the visible Save button through the native save path", async () => {
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Button.md",
      mtimeMs: 102,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Button.md",
        content: "button\n",
        mtimeMs: 101,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Button.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "button\nsaved\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/Button.md",
      content: "button\nsaved\n",
      expectedMtimeMs: 101,
      lineEnding: "lf",
    });
    expect(screen.getByRole("button", { name: "Save document" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Meta+S",
    );

    cleanupShell();
  });

  it("routes a directly-opened .markdown file through Save As on Cmd+S", async () => {
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Notes.MARKDOWN",
      mtimeMs: 13,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Notes.md",
      mtimeMs: 14,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Notes.MARKDOWN",
        content: "one\ntwo\n",
        mtimeMs: 12,
        lineEnding: "lf" as const,
      })),
      saveFile,
      saveFileAs,
    });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Notes.MARKDOWN",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFileAs).toHaveBeenCalledWith({
      suggestedName: "Notes.MARKDOWN",
      content: "one\ntwo\n",
      lineEnding: "lf",
    });
    expect(saveFile).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("reconstructs imported native files and sends them through convertFile", async () => {
    mockDoc2mdProtocol();
    convertFileMock.mockResolvedValue(createSuccessResult("# Imported"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["hello world"], { type: "text/plain" }), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/sample.txt",
          name: "sample.txt",
          mtimeMs: 10,
        }),
      ),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() =>
      expect(convertFileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "sample.txt",
          type: "text/plain",
          lastModified: 10,
        }),
      ),
    );
    expect(await screen.findByRole("button", { name: /sample\.md/i })).toBeInTheDocument();
    expect(screen.getAllByText("Edited").length).toBeGreaterThan(0);

    cleanupShell();
  });

  it("surfaces the 413 oversized-import reason from the native handoff", async () => {
    mockDoc2mdProtocol();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("This file is too large to import (limit: 128 MB).", {
          status: 413,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/oversized.txt",
          name: "oversized.txt",
          mtimeMs: 10,
        }),
      ),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      await screen.findByText(
        "This file is too large to import (limit: 128 MB).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Import failed before the app received the file bytes."),
    ).not.toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("routes an imported document's first save to Save As and anchors later saves", async () => {
    mockDoc2mdProtocol();
    convertFileMock.mockResolvedValue(createSuccessResult("# Imported"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["hello world"], { type: "text/plain" }), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Imported.md",
      mtimeMs: 22,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Imported.md",
      mtimeMs: 21,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/imported.txt",
          name: "imported.txt",
          mtimeMs: 20,
        }),
      ),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /imported\.md/i })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(convertFileMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "imported.txt" }),
      ),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFileAs).toHaveBeenCalledWith({
      suggestedName: "imported.md",
      content: "# Imported",
      lineEnding: "lf",
    });
    expect(saveFile).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/Imported.md",
      content: "# Imported",
      expectedMtimeMs: 21,
      lineEnding: "lf",
    });

    cleanupShell();
  });

  it("does not save imported output while conversion is still running", async () => {
    mockDoc2mdProtocol();
    let resolveConversion: ((value: ReturnType<typeof createSuccessResult>) => void) | undefined;
    convertFileMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConversion = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["hello world"], { type: "text/plain" }), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Imported.md",
      mtimeMs: 31,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Imported.md",
      mtimeMs: 30,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/pending.txt",
          name: "pending.txt",
          mtimeMs: 29,
        }),
      ),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByText("Converting locally.");

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(
      await screen.findByText("Finishing conversion. Try saving again in a moment."),
    ).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    expect(saveFileAs).not.toHaveBeenCalled();

    resolveConversion?.(createSuccessResult("# Pending"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /pending\.md/i })).toBeInTheDocument(),
    );

    cleanupShell();
  });

  it("does not save an imported entry whose conversion failed", async () => {
    mockDoc2mdProtocol();
    mockOversizedImportedFileSize();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["small payload"], { type: "text/plain" }), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Oversized.md",
      mtimeMs: 45,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Oversized.md",
      mtimeMs: 44,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/oversized.txt",
          name: "oversized.txt",
          mtimeMs: 43,
        }),
      ),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      (await screen.findAllByText(OVERSIZED_FILE_MESSAGE)).length,
    ).toBeGreaterThan(0);
    expect(convertFileMock).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(
      await screen.findByText(
        "Cannot save: conversion failed. Please re-open the file or choose another.",
      ),
    ).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    expect(saveFileAs).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("shows the release-bundle import notice outside the doc2md scheme", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/dev-only.txt",
          name: "dev-only.txt",
        }),
      ),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      await screen.findByText(
        "Importing non-Markdown files requires the Release desktop bundle. Run `npm run build:mac` or open the file from the installed app.",
      ),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("routes clean scratch saves to Save As and preserves cancellation as saved", async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: false as const,
      code: "cancelled" as const,
    }));
    const cleanupShell = installMockShell({ saveFileAs });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await screen.findByRole("button", { name: /untitled\.md/i });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFileAs).toHaveBeenCalledWith({
      suggestedName: "Untitled.md",
      content: "",
      lineEnding: "lf",
    });
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it("preserves a clean saved document state when Save As is cancelled", async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: false as const,
      code: "cancelled" as const,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Clean.md",
        content: "clean",
        mtimeMs: 15,
        lineEnding: "lf" as const,
      })),
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Clean.md",
      ),
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it("updates the entry name and next Save As suggestion after Save As succeeds", async () => {
    const saveFileAs = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Renamed.md",
        mtimeMs: 20,
      })
      .mockResolvedValueOnce({
        ok: false as const,
        code: "cancelled" as const,
      });
    const cleanupShell = installMockShell({ saveFileAs });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await screen.findByRole("button", { name: /untitled\.md/i });

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /renamed\.md/i })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Renamed.md",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(2));
    expect(saveFileAs).toHaveBeenLastCalledWith({
      suggestedName: "Renamed.md",
      content: "",
      lineEnding: "lf",
    });

    cleanupShell();
  });

  it("shows conflict actions and retries overwrite with actual mtime", async () => {
    const saveFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Conflict.md",
        actualMtimeMs: 30,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Conflict.md",
        mtimeMs: 31,
      });
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Conflict.md",
        content: "draft",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    const { container } = render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Conflict.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    expect(container.querySelector(".save-state-pill")).toHaveTextContent(
      "Conflict",
    );
    expect(screen.getByRole("button", { name: "Save document" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(saveFile).toHaveBeenLastCalledWith({
      path: "/Users/me/Conflict.md",
      content: "draft",
      expectedMtimeMs: 30,
      lineEnding: "lf",
    });

    cleanupShell();
  });

  it("cancels desktop New from a conflict without clearing the pending conflict", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Conflict.md",
        content: "local",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })),
      saveFile: vi.fn(async () => ({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Conflict.md",
        actualMtimeMs: 21,
      })),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /conflict\.md/i });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "local edit" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("File changed on disk.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conflict\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit markdown")).toHaveValue("local edit");
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Conflict",
    );

    cleanupShell();
  });

  it("accepts desktop New from a conflict and leaves no orphaned conflict", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const saveFile = vi.fn(async () => ({
      ok: false as const,
      code: "conflict" as const,
      path: "/Users/me/Conflict.md",
      actualMtimeMs: 21,
    }));
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Untitled.md",
      mtimeMs: 22,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Conflict.md",
        content: "local",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })),
      saveFile,
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /conflict\.md/i });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "local edit" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("File changed on disk.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull();
    expect(screen.queryByRole("button", { name: /conflict\.md/i })).toBeNull();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(editor).toHaveValue("");
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledTimes(1);

    cleanupShell();
  });

  it("shows Error in the toolbar pill when native save fails", async () => {
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Error.md",
        content: "draft",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })),
      saveFile: vi.fn(async () => ({
        ok: false as const,
        code: "error" as const,
        message: "Disk write failed.",
      })),
    });
    const { container } = render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Error.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));

    expect(await screen.findByText("Disk write failed.")).toBeInTheDocument();
    expect(container.querySelector(".save-state-pill")).toHaveTextContent(
      "Error",
    );

    cleanupShell();
  });

  it("keeps conflict overwrite targeted to the conflicted document after selection changes", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "alpha",
        mtimeMs: 100,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "beta",
        mtimeMs: 200,
        lineEnding: "lf" as const,
      });
    const saveFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Alpha.md",
        actualMtimeMs: 101,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Alpha.md",
        mtimeMs: 102,
      });
    const cleanupShell = installMockShell({ openFile, saveFile });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /alpha\.md/i });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /beta\.md/i });

    fireEvent.click(screen.getByRole("button", { name: /alpha\.md/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Alpha.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");

    fireEvent.click(screen.getByRole("button", { name: /beta\.md/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Beta.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(saveFile).toHaveBeenLastCalledWith({
      path: "/Users/me/Alpha.md",
      content: "alpha",
      expectedMtimeMs: 101,
      lineEnding: "lf",
    });
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Alpha.md",
    );

    cleanupShell();
  });

  it("reloads a conflicted file through the current-session openFile path", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "local",
        mtimeMs: 40,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "disk",
        mtimeMs: 41,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({
      openFile,
      saveFile: vi.fn(async () => ({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Reload.md",
        actualMtimeMs: 41,
      })),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Reload.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    await waitFor(() =>
      expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Reload.md" }),
    );
    expect(await screen.findByText("disk")).toBeInTheDocument();

    cleanupShell();
  });

  it("fails conflict reloads that return a non-markdown shell result", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "local",
        mtimeMs: 40,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce(
        createMockImportShellFile({
          path: "/Users/me/Reload.md",
          name: "Reload.txt",
          format: "txt",
        }),
      );
    const cleanupShell = installMockShell({
      openFile,
      saveFile: vi.fn(async () => ({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Reload.md",
        actualMtimeMs: 41,
      })),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /reload\.md/i });

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(
      await screen.findByText("Reload failed: file is no longer a Markdown target."),
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "conflict-reload received non-markdown kind",
    );

    cleanupShell();
  });

  it("guards repeated native save events while a save is pending", async () => {
    let resolveSave: (value: {
      ok: true;
      path: string;
      mtimeMs: number;
    }) => void = () => {};
    const saveFile = vi.fn(
      () =>
        new Promise<{ ok: true; path: string; mtimeMs: number }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Pending.md",
        content: "pending",
        mtimeMs: 50,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Pending.md",
      ),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    resolveSave({ ok: true, path: "/Users/me/Pending.md", mtimeMs: 51 });
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);

    cleanupShell();
  });

  it("reveals saved files from the visible control and native menu event", async () => {
    const revealInFinder = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Reveal.md",
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reveal.md",
        content: "reveal",
        mtimeMs: 60,
        lineEnding: "lf" as const,
      })),
      revealInFinder,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Reveal.md",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    await waitFor(() => expect(revealInFinder).toHaveBeenCalledTimes(2));
    expect(revealInFinder).toHaveBeenCalledWith({ path: "/Users/me/Reveal.md" });
    expect(await screen.findByText("Revealed Reveal.md in Finder.")).toBeInTheDocument();

    cleanupShell();
  });

  it("does not call reveal without a saved path and surfaces reveal failures", async () => {
    const revealInFinder = vi.fn(async () => ({
      ok: false as const,
      code: "permission-needed" as const,
      path: "/Users/me/Denied.md",
      message: "Select the document again.",
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Denied.md",
        content: "denied",
        mtimeMs: 70,
        lineEnding: "lf" as const,
      })),
      revealInFinder,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    expect(
      await screen.findByText("Save the document before revealing it in Finder."),
    ).toBeInTheDocument();
    expect(revealInFinder).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Denied.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    expect(
      await screen.findByText("Permission needed: Select the document again."),
    ).toBeInTheDocument();

    cleanupShell();
  });
});

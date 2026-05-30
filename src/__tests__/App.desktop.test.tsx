// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesktopApp from "../desktop/DesktopApp";
import type { Doc2mdShell } from "../types/doc2mdShell";
import {
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import {
  createMockShell,
  createMockImportShellFile,
  installMockShell,
} from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

// The working-mode auto-collapse fires on first non-scratch entry open and
// hides the file list behind the upload rail. Tests that interact with
// file-list items call this helper to re-expand.
function ensureSidebarVisible() {
  const showButton = screen.queryByRole("button", { name: "Show upload panel" });
  if (showButton) {
    fireEvent.click(showButton);
  }
}

// `findByRole` races with auto-collapse: after a file opens, the file-list
// buttons exist briefly, then auto-collapse hides them. Two-step approach:
// (1) wait for the rail OR the file button (whichever appears),
// (2) if the rail is up, click to expand,
// (3) re-find the file button. waitFor callbacks stay side-effect-free.
async function awaitOpenButton(name: string | RegExp): Promise<HTMLElement> {
  await waitFor(() => {
    const open = screen.queryByRole("button", { name });
    const rail = screen.queryByRole("button", { name: "Show upload panel" });
    if (!open && !rail) {
      throw new Error(`Neither ${name} nor the upload rail is visible yet`);
    }
  });
  ensureSidebarVisible();
  return await screen.findByRole("button", { name });
}

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

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
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
    delete document.documentElement.dataset.theme;
    localStorage.clear();
    sessionStorage.clear();
    cleanup();
  });

  it("renders no desktop-only DOM when window.doc2mdShell is absent", () => {
    render(<DesktopApp />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
  });

  it("stats a desktop-backed file on activation and marks only that entry conflicted when mtime changed", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const statFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      path,
      mtimeMs: path.endsWith("Alpha.md") ? 11 : 20,
    }));
    const cleanupShell = installMockShell({ openFile, statFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Alpha.md");
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Beta.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Alpha.md" }));

    await waitFor(() => {
      expect(statFile).toHaveBeenCalledWith({ path: "/Users/me/Alpha.md" });
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Conflict",
      );
    });
    expect(screen.getByRole("button", { name: "Open Alpha.md" })).toHaveTextContent(
      "Conflict",
    );
    expect(screen.getByRole("button", { name: "Open Beta.md" })).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it("same-mtime stat activation preserves local edited state and does not reload content", async () => {
    const openFile = vi.fn(async () => ({
      ok: true as const,
      kind: "markdown" as const,
      path: "/Users/me/Edited.md",
      content: "# Edited",
      mtimeMs: 30,
      lineEnding: "lf" as const,
    }));
    const statFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Edited.md",
      mtimeMs: 30,
    }));
    const cleanupShell = installMockShell({ openFile, statFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Edited.md");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
      target: { value: "# Locally edited" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton("Open Untitled.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Edited.md" }));

    await waitFor(() => expect(statFile).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent("Unsaved");
    expect(
      screen.getByRole("heading", { name: "Locally edited" }),
    ).toBeInTheDocument();
    expect(openFile).toHaveBeenCalledTimes(1);

    cleanupShell();
  });

  it("reloads the active saved desktop file from disk", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "# Local",
        mtimeMs: 40,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "# Disk",
        mtimeMs: 41,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Local" });

    fireEvent.click(screen.getByRole("button", { name: "Reload from disk" }));

    await waitFor(() =>
      expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Reload.md" }),
    );
    expect(await screen.findByRole("heading", { name: "Disk" })).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it.each([
    {
      nativeMessage: "Alpha stat failed.",
      notice:
        "Unable to reload file from disk: Alpha stat failed. Check the file, then try Reload again.",
    },
    {
      nativeMessage: "Alpha stat failed",
      notice:
        "Unable to reload file from disk: Alpha stat failed. Check the file, then try Reload again.",
    },
    {
      nativeMessage: "Alpha stat failed:",
      notice:
        "Unable to reload file from disk: Alpha stat failed: Check the file, then try Reload again.",
    },
  ])("shows reload failures with one sentence break before the next action", async ({ nativeMessage, notice }) => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Reload.md",
        content: "# Local",
        mtimeMs: 40,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: false as const,
        code: "error" as const,
        message: nativeMessage,
      });
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Local" });

    fireEvent.click(screen.getByRole("button", { name: "Reload from disk" }));

    expect(await screen.findByText(notice)).toBeInTheDocument();

    cleanupShell();
  });

  it("confirms before reloading an edited desktop file", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Edited.md",
        content: "# Original",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Edited.md",
        content: "# Disk",
        mtimeMs: 21,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Original" });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
      target: { value: "# Local edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload from disk" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Reload from disk and discard unsaved changes?",
    );
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Edit markdown" })).toHaveValue(
      "# Local edit",
    );

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Reload from disk" }));

    await waitFor(() =>
      expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Edited.md" }),
    );
    expect(await screen.findByRole("heading", { name: "Disk" })).toBeInTheDocument();

    cleanupShell();
  });

  it.each([
    {
      label: "permission-needed",
      result: {
        ok: false as const,
        code: "permission-needed" as const,
        path: "/Users/me/Alpha.md",
        message: "Select Alpha again.",
      },
      activeStatus: "Permission needed",
      activeRowStatus: "Permission",
      notice: "Permission needed: Select Alpha again.",
    },
    {
      label: "error",
      result: {
        ok: false as const,
        code: "error" as const,
        message: "Alpha stat failed.",
      },
      activeStatus: "Error",
      activeRowStatus: "Error",
      notice: "Alpha stat failed.",
    },
  ])("statFile $label updates only the active entry", async ({ result, activeStatus, activeRowStatus, notice }) => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const statFile = vi.fn(async ({ path }: { path: string }) =>
      path.endsWith("Alpha.md")
        ? result
        : { ok: true as const, path, mtimeMs: 20 },
    );
    const cleanupShell = installMockShell({ openFile, statFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Alpha.md");
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Beta.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Alpha.md" }));

    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      activeStatus,
    );
    expect(screen.getByRole("button", { name: "Open Alpha.md" })).toHaveTextContent(
      activeRowStatus,
    );
    expect(screen.getByRole("button", { name: "Open Beta.md" })).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it("saved draft external mtime change conflicts on the next Save", async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/SavedDraft.md",
      mtimeMs: 100,
    }));
    const saveFile = vi.fn(async () => ({
      ok: false as const,
      code: "conflict" as const,
      path: "/Users/me/SavedDraft.md",
      actualMtimeMs: 101,
    }));
    const cleanupShell = installMockShell({ saveFile, saveFileAs });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Saved draft" },
    });

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    await awaitOpenButton("Open SavedDraft.md");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Saved draft\n\nLocal change" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/SavedDraft.md",
      content: "# Saved draft\n\nLocal change",
      expectedMtimeMs: 100,
      lineEnding: "lf",
    });
    expect(saveFileAs).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overwrite" })).toBeInTheDocument();

    cleanupShell();
  });

  it("exports HTML via native save-as without mutating the Markdown document", async () => {
    const saveFileAs: Doc2mdShell["saveFileAs"] = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Exported.html",
      mtimeMs: 500,
    }));
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Doc.md",
      mtimeMs: 1,
    }));
    const cleanupShell = installMockShell({ saveFile, saveFileAs });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Export me\n\nBody text." },
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Unsaved",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Download HTML" }));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    const exportArgs = vi.mocked(saveFileAs).mock.calls[0][0];
    expect(exportArgs.format).toBe("html");
    expect(exportArgs.lineEnding).toBe("lf");
    expect(exportArgs.suggestedName.endsWith(".html")).toBe(true);
    expect(exportArgs.content).toContain("<!DOCTYPE html>");
    expect(exportArgs.content).toContain("Export me");

    // BL-5: HTML export must NOT mutate the active Markdown document.
    // The Markdown save path is never written, the entry keeps its .md name,
    // and the save-state pill stays "Unsaved" (export does not mark saved).
    expect(saveFile).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Open Exported.html" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Unsaved",
    );

    cleanupShell();
  });

  it("statFile refresh does not reload file content", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha from open",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const statFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      path,
      mtimeMs: 11,
    }));
    const cleanupShell = installMockShell({ openFile, statFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Alpha.md");
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Beta.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Alpha.md" }));

    await screen.findByText("File changed on disk.");
    expect(screen.getByRole("heading", { name: "Alpha from open" })).toBeInTheDocument();
    expect(openFile).toHaveBeenCalledTimes(2);

    cleanupShell();
  });

  it("stale stat responses are ignored after the entry is cleared", async () => {
    const alphaStat = createDeferred<{
      ok: true;
      path: string;
      mtimeMs: number;
    }>();
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const statFile = vi.fn(({ path }: { path: string }) =>
      path.endsWith("Alpha.md")
        ? alphaStat.promise
        : Promise.resolve({ ok: true as const, path, mtimeMs: 20 }),
    );
    const cleanupShell = installMockShell({ openFile, statFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Alpha.md");
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open Beta.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Alpha.md" }));
    await waitFor(() =>
      expect(statFile).toHaveBeenCalledWith({ path: "/Users/me/Alpha.md" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear active file" }));
    expect(
      screen.queryByRole("button", { name: "Open Alpha.md" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      alphaStat.resolve({
        ok: true,
        path: "/Users/me/Alpha.md",
        mtimeMs: 99,
      });
      await alphaStat.promise;
    });

    expect(screen.queryByText("File changed on disk.")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Beta.md" })).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Beta.md",
    );

    cleanupShell();
  });

  it("scratch and import entries do not call statFile on activation", async () => {
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
    const statFile = vi.fn(async ({ path }: { path: string }) => ({
      ok: true as const,
      path,
      mtimeMs: 1,
    }));
    const cleanupShell = installMockShell({
      statFile,
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          path: "/Users/me/imported.txt",
          name: "imported.txt",
          mtimeMs: 10,
        }),
      ),
    });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton("Open imported.md");

    fireEvent.click(screen.getByRole("button", { name: "Open Untitled.md" }));
    fireEvent.click(screen.getByRole("button", { name: "Open imported.md" }));

    expect(statFile).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("gates desktop-only DOM when the shell version is incompatible", () => {
    const cleanupShell = installMockShell({ version: 1 });

    render(<DesktopApp />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desktop settings" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();

    cleanupShell();
  });

  it("gates desktop-only DOM when a version 2 shell is missing persistence methods", () => {
    const setPersistenceEnabled = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: false,
      recentFiles: [],
    }));
    window.doc2mdShell = {
      ...createMockShell({ setPersistenceEnabled }),
      getPersistenceSettings: undefined,
    } as unknown as Doc2mdShell;

    render(<DesktopApp />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desktop settings" }),
    ).not.toBeInTheDocument();
    expect(setPersistenceEnabled).not.toHaveBeenCalled();
  });

  it("does not show desktop file status before a file or draft exists", () => {
    const cleanupShell = installMockShell();

    render(<DesktopApp />);

    expect(
      screen.queryByLabelText("Desktop file status"),
    ).not.toBeInTheDocument();

    cleanupShell();
  });

  it("routes native New through the shared add-draft action", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const cleanupShell = installMockShell();

    render(<DesktopApp />);

    expect(screen.getByTestId("desktop-menu-bridge")).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(await awaitOpenButton(/untitled\.md/i)).toBeInTheDocument();
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

  it("shows desktop working-mode chrome for a non-scratch entry", async () => {
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
    });
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await screen.findByRole("heading", { name: "Alpha" });
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(screen.getByRole("button", { name: "Show intro and return to landing" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();

    cleanupShell();
  });

  it("promotes desktop scratch entry to working mode after a large paste", async () => {
    // Regression guard. PR #135 ("Refactor: collapse App.tsx and
    // DesktopApp.tsx into shared AppShell") wired onLargeMarkdownPaste to a
    // no-op in the desktop adapter, which silently broke the auto-shrink-on-
    // paste flow that the hosted web build had always supported. Catch it
    // here so the desktop adapter stays in step with the web adapter.
    const cleanupShell = installMockShell();
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    expect(await awaitOpenButton(/untitled\.md/i)).toBeInTheDocument();
    expect(container.querySelector(".page")).not.toHaveClass("is-working-mode");

    const editor = await screen.findByRole("textbox", {
      name: "Edit markdown",
    });
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "x".repeat(201) : ""),
      },
    });

    await waitFor(() => {
      expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    });
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show intro and return to landing" }),
    ).toBeInTheDocument();

    cleanupShell();
  });

  it("keeps desktop scratch entries on landing chrome", async () => {
    const cleanupShell = installMockShell();
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(await awaitOpenButton(/untitled\.md/i)).toBeInTheDocument();
    expect(container.querySelector(".page")).not.toHaveClass("is-working-mode");
    expect(
      screen.getByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show intro and return to landing" })).not.toBeInTheDocument();

    cleanupShell();
  });

  it("returns Home without clearing desktop entries and re-enters working mode on another open", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({ openFile });
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Alpha" });
    ensureSidebarVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show intro and return to landing" }));

    expect(container.querySelector(".page")).not.toHaveClass("is-working-mode");
    expect(screen.getByRole("button", { name: "Open Alpha.md" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await screen.findByRole("heading", { name: "Beta" });
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    ensureSidebarVisible();
    expect(screen.getByRole("button", { name: "Open Alpha.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Beta.md" })).toBeInTheDocument();

    cleanupShell();
  });

  it("keeps desktop settings available beside theme controls in working mode", async () => {
    const openFile = vi.fn(async (args?: { path?: string }) => {
      if (args?.path) {
        return {
          ok: true as const,
          kind: "markdown" as const,
          path: args.path,
          content: "# Recent",
          mtimeMs: 20,
          lineEnding: "lf" as const,
        };
      }

      return {
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      };
    });
    const cleanupShell = installMockShell({
      openFile,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Recent.md",
            displayName: "Recent.md",
            lastOpenedAt: "2026-05-12T22:11:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);
    await screen.findByRole("button", { name: "Desktop settings" });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Alpha" });

    const settingsButton = screen.getByRole("button", {
      name: "Desktop settings",
    });
    expect(settingsButton.closest(".working-mode-trailing-controls")).toBeTruthy();
    fireEvent.click(settingsButton);
    const settingsDialog = screen.getByRole("dialog", {
      name: "Desktop settings",
    });
    expect(settingsDialog.closest(".working-mode-trailing-controls")).toBeTruthy();
    fireEvent.keyDown(settingsDialog, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Desktop settings" }),
      ).not.toBeInTheDocument(),
    );

    const open = screen.getByRole("button", { name: "Open" });
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-haspopup", "menu");
    expect(open).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("menuitem", { name: /Recent\.md/ }));

    await screen.findByRole("heading", { name: "Recent" });
    expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Recent.md" });

    cleanupShell();
  });

  it("keeps the desktop upload panel expanded after a Home roundtrip and second open", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Beta.md",
        content: "# Beta",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({ openFile });
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Alpha" });
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show intro and return to landing" }));
    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));
    expect(
      screen.getByRole("button", { name: "Hide upload panel" }),
    ).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await screen.findByRole("heading", { name: "Beta" });
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(
      screen.getByRole("button", { name: "Hide upload panel" }),
    ).toBeInTheDocument();

    cleanupShell();
  });

  it("eyebrow toggle collapses landing back into working mode when an entry exists", async () => {
    const openFile = vi.fn().mockResolvedValueOnce({
      ok: true as const,
      kind: "markdown" as const,
      path: "/Users/me/Alpha.md",
      content: "# Alpha",
      mtimeMs: 10,
      lineEnding: "lf" as const,
    });
    const cleanupShell = installMockShell({ openFile });
    const { container } = render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.click(
      screen.getByRole("button", { name: "Show intro and return to landing" }),
    );
    expect(container.querySelector(".page")).not.toHaveClass("is-working-mode");

    fireEvent.click(
      screen.getByRole("button", { name: "Hide intro and return to editor" }),
    );

    expect(container.querySelector(".page")).toHaveClass("is-working-mode");

    cleanupShell();
  });

  it("eyebrow toggle is a no-op on landing when no non-scratch entry exists", () => {
    const cleanupShell = installMockShell();
    const { container } = render(<DesktopApp />);

    fireEvent.click(
      screen.getByRole("button", { name: "doc2md, private markdown workspace" }),
    );

    expect(container.querySelector(".page")).not.toHaveClass("is-working-mode");

    cleanupShell();
  });

  it("creates separate uniquely named drafts on repeated native New", async () => {
    const cleanupShell = installMockShell();

    render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton("Open Untitled.md");
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect((await screen.findAllByText("Untitled 2.md")).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("2 drafts")).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Untitled 2.md",
    );

    cleanupShell();
  });

  it("adds a clean scratch from a saved desktop file without confirming or removing the file", async () => {
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/original\.md/i);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    // Editor focus arrives via setTimeout(0) in PreviewPanel; on slow CI the
    // 1s default timeout is tight. 5s matches findBy* semantics.
    await waitFor(() => expect(document.activeElement).toBe(editor), {
      timeout: 5000,
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /original\.md/i })).toBeInTheDocument();
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

  it("adds a scratch from a dirty file without prompting and restores dirty state when reselected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/dirty\.md/i);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Dirty\n\nKeep this" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent("Unsaved"),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(confirmSpy).not.toHaveBeenCalled();
    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(editor).toHaveValue("");
    expect(screen.getByRole("button", { name: /dirty\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    fireEvent.click(screen.getByRole("button", { name: /dirty\.md/i }));

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Edit markdown")).toHaveValue(
      "# Dirty\n\nKeep this",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent("Unsaved"),
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "/Users/me/Dirty.md",
    );

    cleanupShell();
  });

  it("saves a new draft through Save As without overwriting the previously selected dirty file", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/dirty\.md/i);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Dirty\n\nDiscard this" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent("Unsaved"),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(editor).toHaveValue("");
    expect(screen.getByRole("button", { name: /dirty\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "No saved path yet.",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFileAs).toHaveBeenCalledWith({
      suggestedName: "Untitled.md",
      content: "",
      lineEnding: "lf",
    });
    expect(saveFile).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("renders the desktop app-ready marker with visible title and save state", async () => {
    const cleanupShell = installMockShell();

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveAttribute(
        "data-app-ready",
        "true",
      ),
    );
    expect(screen.getAllByText("Untitled.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
    const shellTitle = document.querySelector(".desktop-shell-title");
    expect(shellTitle).toHaveTextContent("Untitled.md");
    expect(shellTitle).not.toHaveAttribute("title");
    const tooltipId = shellTitle?.getAttribute("aria-describedby");
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId ?? "")).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(document.getElementById(tooltipId ?? "")).toHaveTextContent(
      "Untitled.md",
    );

    cleanupShell();
  });

  it("renders desktop persistence settings with actionable recent files", async () => {
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        theme: "dark" as const,
        recentFiles: [
          {
            path: "/Users/me/Notes.md",
            displayName: "Notes.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);

    const settingsButton = await screen.findByRole("button", {
      name: "Desktop settings",
    });
    expect(settingsButton).toHaveAttribute("aria-describedby");

    fireEvent.click(settingsButton);
    expect(settingsButton).not.toHaveAttribute("aria-describedby");
    expect(within(settingsButton).queryByRole("tooltip")).not.toBeInTheDocument();

    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    expect(settingsDialog.closest(".hero")).toHaveClass("hero--settings-open");
    expect(screen.getByLabelText("Persistence")).toBeChecked();
    expect(within(settingsDialog).getByText("Recent files")).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole("button", { name: "Clear history" }),
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).getByRole("button", { name: /Notes\.md/ }),
    ).toBeInTheDocument();
    expect(within(settingsDialog).getByText("/Users/me/Notes.md")).toBeInTheDocument();

    cleanupShell();
  });

  it("clears desktop recent history without disabling persistence", async () => {
    const clearRecentFiles = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      theme: "dark" as const,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      clearRecentFiles,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        theme: "dark" as const,
        recentFiles: [
          {
            path: "/Users/me/Old.md",
            displayName: "Old.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });

    fireEvent.click(within(settingsDialog).getByRole("button", { name: "Clear history" }));

    await waitFor(() => expect(clearRecentFiles).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Persistence")).toBeChecked();
    expect(within(settingsDialog).queryByText("Old.md")).not.toBeInTheDocument();
    expect(within(settingsDialog).getByText("No recent files yet.")).toBeInTheDocument();

    cleanupShell();
  });

  it("clears restored session paths without closing the active file", async () => {
    const clearRecentFiles = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      recentFiles: [],
    }));
    const setSessionState = vi.fn(async (args: {
      openPaths: string[];
      selectedPath?: string;
    }) => ({
      ok: true as const,
      ...args,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      clearRecentFiles,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Current.md",
            displayName: "Current.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      })),
      getSessionState: vi.fn(async () => ({
        ok: true as const,
        openPaths: [],
        recentFiles: [],
      })),
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Current.md",
        content: "# Current\n",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
      setSessionState,
    });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Current" });
    await waitFor(() =>
      expect(setSessionState).toHaveBeenCalledWith({
        openPaths: ["/Users/me/Current.md"],
        selectedPath: "/Users/me/Current.md",
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    fireEvent.click(within(settingsDialog).getByRole("button", { name: "Clear history" }));

    await waitFor(() => expect(clearRecentFiles).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Current" })).toBeInTheDocument();
    expect(within(settingsDialog).getByText("No recent files yet.")).toBeInTheDocument();

    setSessionState.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Current\n\nEdited after clearing history" },
    });

    await waitFor(() =>
      expect(setSessionState).toHaveBeenCalledWith({
        openPaths: [],
        selectedPath: undefined,
      }),
    );
    expect(setSessionState).not.toHaveBeenCalledWith({
      openPaths: ["/Users/me/Current.md"],
      selectedPath: "/Users/me/Current.md",
    });

    cleanupShell();
  });

  it("opens settings recent files and marks unavailable files for retry", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "permission-needed" as const,
        path: "/Users/me/Recent.md",
        message: "Open the file again.",
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Recent.md",
        content: "# Recent",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({
      openFile,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Recent.md",
            displayName: "Recent.md",
            lastOpenedAt: "2026-05-12T22:11:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));

    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    fireEvent.click(within(settingsDialog).getByRole("button", { name: /Recent\.md/ }));

    await waitFor(() =>
      expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Recent.md" }),
    );
    const recentButton = within(settingsDialog).getByRole("button", {
      name: /Recent\.md/,
    });
    await waitFor(() => expect(recentButton).toHaveClass("is-unavailable"));
    expect(recentButton).not.toHaveAttribute("title");
    const tooltipId = recentButton.getAttribute("aria-describedby");
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId ?? "")).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(document.getElementById(tooltipId ?? "")).toHaveClass(
      "recent-file-tooltip",
    );
    expect(document.getElementById(tooltipId ?? "")).toHaveTextContent(
      "Not available. Click to retry opening this file.",
    );

    fireEvent.click(recentButton);

    await screen.findByRole("heading", { name: "Recent" });
    expect(openFile).toHaveBeenCalledTimes(2);
    expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Recent.md" });
    expect(
      screen.queryByRole("dialog", { name: "Desktop settings" }),
    ).not.toBeInTheDocument();

    cleanupShell();
  });

  it("selects already-open settings recent files without reopening a duplicate", async () => {
    const openFile = vi.fn(async () => ({
      ok: true as const,
      kind: "markdown" as const,
      path: "/Users/me/Alpha.md",
      content: "# Alpha",
      mtimeMs: 10,
      lineEnding: "lf" as const,
    }));
    const cleanupShell = installMockShell({
      openFile,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Alpha.md",
            displayName: "Alpha.md",
            lastOpenedAt: "2026-05-12T22:11:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);
    await screen.findByRole("button", { name: "Desktop settings" });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Alpha" });
    expect(openFile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Desktop settings" }));
    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    fireEvent.click(within(settingsDialog).getByRole("button", { name: /Alpha\.md/ }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Desktop settings" }),
      ).not.toBeInTheDocument(),
    );
    expect(openFile).toHaveBeenCalledTimes(1);
    ensureSidebarVisible();
    expect(screen.getAllByRole("button", { name: "Open Alpha.md" })).toHaveLength(1);

    cleanupShell();
  });

  it("ignores repeated settings recent clicks while native open is pending", async () => {
    const pendingOpen = createDeferred<{
      ok: true;
      kind: "markdown";
      path: string;
      content: string;
      mtimeMs: number;
      lineEnding: "lf";
    }>();
    const openFile = vi.fn(() => pendingOpen.promise);
    const cleanupShell = installMockShell({
      openFile,
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Recent.md",
            displayName: "Recent.md",
            lastOpenedAt: "2026-05-12T22:11:00.000Z",
          },
        ],
      })),
    });

    render(<DesktopApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    const settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    const recentButton = within(settingsDialog).getByRole("button", {
      name: /Recent\.md/,
    });

    fireEvent.click(recentButton);
    fireEvent.click(recentButton);
    fireEvent.click(recentButton);
    fireEvent.click(recentButton);
    fireEvent.click(recentButton);

    expect(openFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingOpen.resolve({
        ok: true,
        kind: "markdown",
        path: "/Users/me/Recent.md",
        content: "# Recent",
        mtimeMs: 20,
        lineEnding: "lf",
      });
      await pendingOpen.promise;
    });

    await screen.findByRole("heading", { name: "Recent" });
    expect(openFile).toHaveBeenCalledTimes(1);
    ensureSidebarVisible();
    expect(screen.getAllByRole("button", { name: "Open Recent.md" })).toHaveLength(1);

    cleanupShell();
  });

  it("restores persisted light theme after desktop settings load", async () => {
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        theme: "light" as const,
        recentFiles: [],
      })),
    });

    render(<DesktopApp />);

    expect(
      await screen.findByRole("button", { name: "Switch to night mode" }),
    ).toBeInTheDocument();
    // The button text reflects React state immediately; the data-theme attribute
    // is updated by a useEffect in ThemeProvider, so it lags by one tick. Poll.
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBeUndefined(),
    );

    cleanupShell();
  });

  it("disabling persistence clears theme and recent files in the settings popover", async () => {
    const setPersistenceEnabled = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: false,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        theme: "dark" as const,
        recentFiles: [
          {
            path: "/Users/me/Old.md",
            displayName: "Old.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      })),
      setPersistenceEnabled,
    });

    render(<DesktopApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    const checkbox = screen.getByLabelText("Persistence");

    expect(checkbox).toBeChecked();
    expect(screen.getByText("Old.md")).toBeInTheDocument();

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(setPersistenceEnabled).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByText("Old.md")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent files")).not.toBeInTheDocument();

    cleanupShell();
  });

  it("refreshes recent files after successful native open and save", async () => {
    const getPersistenceSettings = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })
      .mockResolvedValueOnce({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Opened.md",
            displayName: "Opened.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [
          {
            path: "/Users/me/Saved.md",
            displayName: "Saved.md",
            lastOpenedAt: "2026-04-28T20:41:00.000Z",
          },
          {
            path: "/Users/me/Opened.md",
            displayName: "Opened.md",
            lastOpenedAt: "2026-04-28T20:40:00.000Z",
          },
        ],
      });
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Saved.md",
      mtimeMs: 12,
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings,
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Opened.md",
        content: "# Opened\n",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() => expect(getPersistenceSettings).toHaveBeenCalledTimes(2));
    // The "Show intro and return to landing" working-mode button (added by
    // PR #122) is rendered async relative to getPersistenceSettings under
    // React 19's batching, so wait for it rather than fetching synchronously.
    fireEvent.click(
      await screen.findByRole("button", { name: "Show intro and return to landing" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Desktop settings" }));
    let settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    expect(within(settingsDialog).getByText("Opened.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "# Opened\n\nSaved" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(getPersistenceSettings).toHaveBeenCalledTimes(3));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/Opened.md",
      content: "# Opened\n\nSaved",
      expectedMtimeMs: 10,
      lineEnding: "lf",
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Show intro and return to landing" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Desktop settings" }));
    settingsDialog = screen.getByRole("dialog", { name: "Desktop settings" });
    expect(within(settingsDialog).getByText("Saved.md")).toBeInTheDocument();

    cleanupShell();
  });

  it("restores saved Markdown session paths and selects the previous document", async () => {
    const openFile = vi.fn(async (args?: { path?: string }) => ({
      ok: true as const,
      kind: "markdown" as const,
      path: args?.path ?? "/Users/me/Manual.md",
      content: args?.path?.endsWith("Beta.md") ? "# Beta\n" : "# Alpha\n",
      mtimeMs: args?.path?.endsWith("Beta.md") ? 20 : 10,
      lineEnding: "lf" as const,
    }));
    const getSessionState = vi.fn(async () => ({
      ok: true as const,
      openPaths: ["/Users/me/Alpha.md", "/Users/me/Beta.md"],
      selectedPath: "/Users/me/Beta.md",
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })),
      getSessionState,
      openFile,
    });

    render(<DesktopApp />);

    await screen.findByRole("heading", { name: "Beta" });
    expect(getSessionState).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenNthCalledWith(1, { path: "/Users/me/Alpha.md" });
    expect(openFile).toHaveBeenNthCalledWith(2, { path: "/Users/me/Beta.md" });
    ensureSidebarVisible();
    expect(screen.getByRole("button", { name: "Open Alpha.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Beta.md" })).toBeInTheDocument();

    cleanupShell();
  });

  it("keeps session-restored native recent files available in the working-mode Open menu", async () => {
    const openFile = vi.fn(async (args?: { path?: string }) => ({
      ok: true as const,
      kind: "markdown" as const,
      path: args?.path ?? "/Users/me/Manual.md",
      content: "# Alpha\n",
      mtimeMs: 10,
      lineEnding: "lf" as const,
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })),
      getSessionState: vi.fn(async () => ({
        ok: true as const,
        openPaths: ["/Users/me/Alpha.md"],
        selectedPath: "/Users/me/Alpha.md",
        recentFiles: [
          {
            path: "/Users/me/Alpha.md",
            displayName: "Alpha.md",
            lastOpenedAt: "2026-05-21T12:00:00.000Z",
          },
        ],
      })),
      openFile,
    });

    render(<DesktopApp />);

    await screen.findByRole("heading", { name: "Alpha" });
    const open = screen.getByRole("button", { name: "Open" });

    expect(open).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(open);

    const recentMenu = screen.getByRole("menu", { name: "Recent files" });
    expect(
      within(recentMenu).getByRole("menuitem", { name: /Alpha\.md/ }),
    ).toBeInTheDocument();
    expect(openFile).toHaveBeenCalledTimes(1);

    cleanupShell();
  });

  it("skips unopenable restored paths without blocking startup", async () => {
    const openFile = vi.fn(async (args?: { path?: string }) => {
      if (args?.path === "/Users/me/Missing.md") {
        return {
          ok: false as const,
          code: "permission-needed" as const,
          path: args.path,
          message: "Open the file again before reloading it.",
        };
      }

      return {
        ok: true as const,
        kind: "markdown" as const,
        path: args?.path ?? "/Users/me/Alpha.md",
        content: "# Alpha\n",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      };
    });
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })),
      getSessionState: vi.fn(async () => ({
        ok: true as const,
        openPaths: ["/Users/me/Missing.md", "/Users/me/Alpha.md"],
        selectedPath: "/Users/me/Missing.md",
        recentFiles: [],
      })),
      openFile,
    });

    render(<DesktopApp />);

    expect(await screen.findByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(openFile).toHaveBeenCalledTimes(2);

    cleanupShell();
  });

  it("does not overwrite native session state when restore throws", async () => {
    const getSessionState = vi.fn(async () => {
      throw new Error("native bridge unavailable");
    });
    const setSessionState = vi.fn(async (args: {
      openPaths: string[];
      selectedPath?: string;
    }) => ({
      ok: true as const,
      ...args,
      recentFiles: [],
    }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })),
      getSessionState,
      setSessionState,
    });

    render(<DesktopApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session restore failed before the app received a native result. Open a file or start a new draft.",
    );
    await waitFor(() => expect(getSessionState).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(setSessionState).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "doc2md desktop session restore failure",
      expect.any(Error),
    );

    cleanupShell();
  });

  it("syncs only disk-backed Markdown paths to native session state", async () => {
    const setSessionState = vi.fn(async (args: {
      openPaths: string[];
      selectedPath?: string;
    }) => ({
      ok: true as const,
      ...args,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: true,
        recentFiles: [],
      })),
      getSessionState: vi.fn(async () => ({
        ok: true as const,
        openPaths: [],
        recentFiles: [],
      })),
      openFile: vi.fn(async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/Users/me/Disk.md",
        content: "# Disk\n",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })),
      setSessionState,
    });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Disk" });

    await waitFor(() =>
      expect(setSessionState).toHaveBeenCalledWith({
        openPaths: ["/Users/me/Disk.md"],
        selectedPath: "/Users/me/Disk.md",
      }),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);

    await waitFor(() =>
      expect(setSessionState).toHaveBeenLastCalledWith({
        openPaths: ["/Users/me/Disk.md"],
        selectedPath: undefined,
      }),
    );

    cleanupShell();
  });

  it("persists theme changes only when desktop persistence is enabled", async () => {
    const getPersistenceSettings = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      theme: "dark" as const,
      recentFiles: [],
    }));
    const setPersistenceTheme = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      theme: "light" as const,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings,
      setPersistenceTheme,
    });

    render(<DesktopApp />);

    await waitFor(() => expect(getPersistenceSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(setPersistenceTheme).not.toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Switch to day mode" }));

    await waitFor(() =>
      expect(setPersistenceTheme).toHaveBeenCalledWith({ theme: "light" }),
    );

    cleanupShell();
  });

  it("persists the current theme when persistence is enabled", async () => {
    const getPersistenceSettings = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: false,
      recentFiles: [],
    }));
    const setPersistenceEnabled = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      recentFiles: [],
    }));
    const setPersistenceTheme = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      theme: "light" as const,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings,
      setPersistenceEnabled,
      setPersistenceTheme,
    });

    render(<DesktopApp />);
    await waitFor(() => expect(getPersistenceSettings).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "Switch to day mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Desktop settings" }));

    fireEvent.click(screen.getByLabelText("Persistence"));

    await waitFor(() =>
      expect(setPersistenceTheme).toHaveBeenCalledWith({ theme: "light" }),
    );
    expect(setPersistenceEnabled).toHaveBeenCalledWith({ enabled: true });

    cleanupShell();
  });

  it("does not persist theme changes when desktop persistence is disabled", async () => {
    const getPersistenceSettings = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: false,
      recentFiles: [],
    }));
    const setPersistenceTheme = vi.fn(async () => ({
      ok: true as const,
      persistenceEnabled: true,
      theme: "light" as const,
      recentFiles: [],
    }));
    const cleanupShell = installMockShell({
      getPersistenceSettings,
      setPersistenceTheme,
    });

    render(<DesktopApp />);
    await waitFor(() => expect(getPersistenceSettings).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: "Switch to day mode" }));

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(setPersistenceTheme).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("shows a desktop notice when persistence settings fail to load", async () => {
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: false as const,
        code: "error" as const,
        message: "Settings unavailable.",
      })),
    });

    render(<DesktopApp />);

    expect(await screen.findByText("Settings unavailable.")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    cleanupShell();
  });

  it("surfaces permission notices when persistence changes fail", async () => {
    const cleanupShell = installMockShell({
      getPersistenceSettings: vi.fn(async () => ({
        ok: true as const,
        persistenceEnabled: false,
        recentFiles: [],
      })),
      setPersistenceEnabled: vi.fn(async () => ({
        ok: false as const,
        code: "permission-needed" as const,
        path: "/Users/me/Library/Application Support/doc2md/settings.json",
        message: "Select the settings file again.",
      })),
    });

    render(<DesktopApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    fireEvent.click(screen.getByLabelText("Persistence"));

    expect(
      await screen.findByText("Permission needed: Select the settings file again."),
    ).toBeInTheDocument();

    cleanupShell();
  });

  it("keeps mode switcher save control and find replace usable when desktop settings opens and closes", async () => {
    const cleanupShell = installMockShell();

    render(<DesktopApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Desktop settings" }));
    expect(screen.getByLabelText("Persistence")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Desktop settings" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Persistence")).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Install & Use" }));
    expect(screen.getByRole("tab", { name: "Install & Use" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Convert" }));

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    const editor = await screen.findByLabelText("Edit markdown");
    fireEvent.change(editor, {
      target: { value: "# Find me\n\nReplace me" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save document" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    const findInput = await screen.findByLabelText("Find markdown text");
    fireEvent.change(findInput, { target: { value: "Find" } });

    expect(findInput).toHaveValue("Find");

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

    render(<DesktopApp />);

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

    render(<DesktopApp />);

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

    render(<DesktopApp />);

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

    render(<DesktopApp />);
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
    expect(await awaitOpenButton(/sample\.md/i)).toBeInTheDocument();
    expect(screen.getAllByText("Unsaved").length).toBeGreaterThan(0);

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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      await screen.findByText(
        "This file is too large to import (limit: 128 MB).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Import failed before the app received the file bytes. Open the file again, or choose another supported file.",
      ),
    ).not.toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();

    cleanupShell();
  });

  it("shows a generic import handoff next action for non-size failures", async () => {
    mockDoc2mdProtocol();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("handoff failed", {
          status: 500,
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      await screen.findByText(
        "Import failed before the app received the file bytes. Open the file again, or choose another supported file.",
      ),
    ).toBeInTheDocument();
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    // Use the same auto-collapse-aware helper the other imported-file tests
    // use. PR #121 introduced the working-mode auto-collapse, which hides
    // file buttons behind the rail; under React 19's tighter batching the
    // old `waitFor(getByRole)` races against the collapse and the button
    // is gone by the time the assertion runs.
    await awaitOpenButton(/imported\.md/i);
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

    // React 19 batches the post-Save-As state updates (path + mtimeMs anchor)
    // more aggressively than 18; wait for the anchored saved-file button to
    // appear so the next save event routes to saveFile, not another saveFileAs.
    // The pre-Save-As button label is "Open imported.md" (lowercase i); after
    // Save As resolves with path /Users/me/Imported.md the label updates to
    // "Open Imported.md" (capital I). Match case-sensitively so this wait
    // actually anchors on the post-Save-As state, not the pre-existing button.
    await awaitOpenButton(/Open Imported\.md/);

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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByText("Converting locally.");

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(
      await screen.findByText("Finishing conversion. Try saving again in a moment."),
    ).toBeInTheDocument();
    expect(saveFile).not.toHaveBeenCalled();
    expect(saveFileAs).not.toHaveBeenCalled();

    resolveConversion?.(createSuccessResult("# Pending"));
    expect(await awaitOpenButton(/pending\.md/i)).toBeInTheDocument();

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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    expect(
      (await screen.findAllByText(OVERSIZED_FILE_MESSAGE)).length,
    ).toBeGreaterThan(0);
    expect(convertFileMock).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(
      await screen.findByText(
        "Cannot save because conversion failed. Re-open the source file or choose another document.",
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

    render(<DesktopApp />);
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

    render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);
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

    render(<DesktopApp />);
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

    render(<DesktopApp />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);

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

    const { container } = render(<DesktopApp />);
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

  it("hides a previous document conflict after New and restores it when reselected", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/conflict\.md/i);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "local edit" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await awaitOpenButton(/untitled\.md/i);

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("File changed on disk.")).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /conflict\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /untitled\.md/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Edit markdown")).toHaveValue("");
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    fireEvent.click(screen.getByRole("button", { name: /conflict\.md/i }));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Edit markdown")).toHaveValue("local edit");
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Conflict",
    );

    cleanupShell();
  });

  it("keeps a conflicted document in the workspace while saving the new draft through Save As", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/conflict\.md/i);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "local edit" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("File changed on disk.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull();
    expect(screen.getByRole("button", { name: /conflict\.md/i })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /conflict\.md/i }));
    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();

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
    const { container } = render(<DesktopApp />);

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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/alpha\.md/i);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/beta\.md/i);

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
    expect(screen.queryByText("File changed on disk.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /alpha\.md/i }));
    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
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

    render(<DesktopApp />);
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

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await awaitOpenButton(/reload\.md/i);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(
      await screen.findByText(
        "Reload failed because the file is no longer Markdown. Choose a Markdown file to continue.",
      ),
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

    render(<DesktopApp />);
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

    render(<DesktopApp />);
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

    render(<DesktopApp />);
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

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesktopApp from "../desktop/DesktopApp";
import {
  installMockShell,
  createMockImportShellFile,
} from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

vi.mock("../converters/browserConversion", () => ({
  convertFileForUi: vi.fn(async () => ({
    markdown: "# Imported",
    warnings: [],
    status: "success",
  })),
}));

const opened = {
  ok: true as const,
  kind: "markdown" as const,
  path: "/mock/Before.md",
  content: "# Original",
  mtimeMs: 10,
  lineEnding: "lf" as const,
};
afterEach(() => {
  cleanup();
  delete window.doc2mdShell;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function openDocument() {
  render(<DesktopApp />);
  await act(async () =>
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open)),
  );
  await screen.findByRole("button", { name: /^Rename document:/ });
}
function submitRename() {
  fireEvent.click(screen.getByRole("button", { name: /^Rename document:/ }));
  const field = screen.getByRole("textbox", { name: "Document name" });
  fireEvent.change(field, { target: { value: "After" } });
  fireEvent.submit(field.closest("form")!);
}
function edit() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
    target: { value: "# Unsaved change" },
  });
}

describe("desktop document rename", () => {
  it("renames the disk binding and saves dirty editor text to the new path", async () => {
    const renameFile = vi.fn(async () => ({
      ok: true as const,
      path: "/mock/After.md",
      mtimeMs: 10,
    }));
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/mock/After.md",
      mtimeMs: 11,
    }));
    installMockShell({
      openFile: vi.fn(async () => opened),
      renameFile,
      saveFile,
    });
    await openDocument();
    edit();
    submitRename();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^Rename document:/ }),
      ).toHaveTextContent("After.md"),
    );
    expect(renameFile).toHaveBeenCalledWith({
      path: "/mock/Before.md",
      name: "After.md",
      expectedMtimeMs: 10,
    });
    expect(screen.getByRole("textbox", { name: "Edit markdown" })).toHaveValue(
      "# Unsaved change",
    );
    await act(async () =>
      window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save)),
    );
    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith({
        path: "/mock/After.md",
        content: "# Unsaved change",
        expectedMtimeMs: 10,
        lineEnding: "lf",
      }),
    );
  });

  it("keeps the original path when native rename fails", async () => {
    const renameFile = vi.fn(async () => ({
      ok: false as const,
      code: "error" as const,
      message: "A file with that name already exists.",
    }));
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: opened.path,
      mtimeMs: 11,
    }));
    installMockShell({
      openFile: vi.fn(async () => opened),
      renameFile,
      saveFile,
    });
    await openDocument();
    edit();
    submitRename();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Document name" }), {
      key: "Escape",
    });
    await act(async () =>
      window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save)),
    );
    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: opened.path }),
      ),
    );
  });

  it("renames an imported output without renaming the source on disk", async () => {
    vi.stubGlobal("location", { ...window.location, protocol: "doc2md:" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Source text", { status: 200 })),
    );
    const renameFile = vi.fn();
    const saveFileAs = vi.fn(async () => ({
      ok: true as const,
      path: "/mock/After.md",
      mtimeMs: 11,
    }));
    installMockShell({
      openFile: vi.fn(async () =>
        createMockImportShellFile({
          name: "Before.txt",
          path: "/mock/Before.txt",
        }),
      ),
      renameFile,
      saveFileAs,
    });
    await openDocument();
    await screen.findByRole("heading", { name: "Imported" });
    submitRename();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^Rename document:/ }),
      ).toHaveTextContent("After.md"),
    );
    expect(renameFile).not.toHaveBeenCalled();
    await act(async () =>
      window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save)),
    );
    await waitFor(() =>
      expect(saveFileAs).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: "After.md",
          content: "# Imported",
        }),
      ),
    );
  });

  it("disables title renaming while a save is pending", async () => {
    let resolveSave!: (result: {
      ok: true;
      path: string;
      mtimeMs: number;
    }) => void;
    const saveFile = vi.fn(
      () =>
        new Promise<{ ok: true; path: string; mtimeMs: number }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const renameFile = vi.fn();
    installMockShell({
      openFile: vi.fn(async () => opened),
      renameFile,
      saveFile,
    });
    await openDocument();
    edit();
    await act(async () =>
      window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save)),
    );
    expect(
      screen.getByRole("button", { name: /^Rename document:/ }),
    ).toBeDisabled();
    expect(renameFile).not.toHaveBeenCalled();
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    await act(async () =>
      resolveSave({ ok: true, path: opened.path, mtimeMs: 11 }),
    );
  });
});

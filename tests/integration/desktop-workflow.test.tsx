// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ThemeProvider from "../../src/components/ThemeProvider";
import { useDesktopAppShellAdapter } from "../../src/shell/desktopAdapter";
import { createMockShell } from "../../src/desktop/mockShellBridge";
import type { ShellResult, ShellSaveOk } from "../../src/types/doc2mdShell";

afterEach(() => {
  delete window.doc2mdShell;
  vi.restoreAllMocks();
});

async function setup() {
  const shell = createMockShell();
  window.doc2mdShell = shell;
  const hook = renderHook(() => useDesktopAppShellAdapter(), { wrapper: ThemeProvider });
  await waitFor(() => expect(shell.getPersistenceSettings).toHaveBeenCalled());
  return { ...hook, shell };
}

describe("desktop draft workflow", () => {
  it("starts every draft in working mode and can return through the intro", async () => {
    const { result } = await setup();
    act(() => result.current.callbacks.onNewDocument());
    expect(result.current.isWorkingMode).toBe(true);
    act(() => result.current.callbacks.onReturnHome());
    expect(result.current.isWorkingMode).toBe(false);
    act(() => result.current.callbacks.onCollapseFromHero());
    expect(result.current.isWorkingMode).toBe(true);
    act(() => result.current.callbacks.onReturnHome());
    act(() => result.current.callbacks.onNewDocument());
    expect(result.current.isWorkingMode).toBe(true);
  });

  it("preserves inactive edited drafts and batch selection when Clear is cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = await setup();
    act(() => result.current.callbacks.onNewDocument());
    act(() => result.current.callbacks.onMarkdownChange("Only draft copy"));
    act(() => result.current.callbacks.onNewDocument());
    const activeId = result.current.selectedEntry!.id;
    act(() => result.current.fileListProps.onToggleAllChecked());
    const checked = result.current.fileListProps.checkedIds;
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.fileListProps.entries).toHaveLength(2);
    expect(result.current.selectedEntry?.id).toBe(activeId);
    expect(result.current.fileListProps.checkedIds).toEqual(checked);
    confirm.mockReturnValue(true);
    act(() => result.current.fileListProps.onClear());
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  it("clears blank drafts and clean native files without confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = await setup();
    act(() => result.current.callbacks.onNewDocument());
    act(() => result.current.fileListProps.onClear());
    await act(async () => { await result.current.workingModeBarProps.onOpen(); });
    expect(result.current.selectedEntry).not.toBeNull();
    act(() => result.current.fileListProps.onClear());
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  const failures: ShellResult<ShellSaveOk>[] = [
    { ok: false, code: "conflict", path: "/mock/Untitled.md", actualMtimeMs: 5 },
    { ok: false, code: "permission-needed", message: "Access expired" },
    { ok: false, code: "error", message: "Disk unavailable" },
  ];
  it.each(failures)("preserves native save metadata and recovery state after $code", async (failure) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, shell } = await setup();
    vi.mocked(shell.saveFile).mockResolvedValueOnce(failure);
    await act(async () => { await result.current.workingModeBarProps.onOpen(); });
    act(() => result.current.callbacks.onMarkdownChange("Local changes"));
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(result.current.previewPanelSaveProps.saveState).toBe(
      failure.ok ? "saved" : failure.code,
    ));
    const entryId = result.current.selectedEntry!.id;
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.selectedEntry?.id).toBe(entryId);
    expect(result.current.selectedEntry?.editedMarkdown).toBe("Local changes");
    act(() => result.current.callbacks.onMarkdownChange("Retry changes"));
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(result.current.previewPanelSaveProps.saveState).toBe("saved"));
    expect(shell.saveFile).toHaveBeenLastCalledWith(expect.objectContaining({
      path: "/mock/Untitled.md", content: "Retry changes",
    }));
    expect(shell.saveFileAs).not.toHaveBeenCalled();
  });

  it("protects a native save that is still in progress", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, shell } = await setup();
    let complete: (value: ShellResult<ShellSaveOk>) => void = () => {};
    vi.mocked(shell.saveFile).mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    await act(async () => { await result.current.workingModeBarProps.onOpen(); });
    act(() => result.current.callbacks.onMarkdownChange("Saving edits"));
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(shell.saveFile).toHaveBeenCalledOnce());
    expect(result.current.previewPanelSaveProps.saveState).toBe("saving");
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.selectedEntry?.editedMarkdown).toBe("Saving edits");
    await act(async () => { complete({ ok: true, path: "/mock/Untitled.md", mtimeMs: 2 }); });
    expect(result.current.previewPanelSaveProps.saveState).toBe("saved");
  });

  it.each([
    { operation: "Save", inactive: false },
    { operation: "Save As", inactive: false },
    { operation: "Save", inactive: true },
    { operation: "Save As", inactive: true },
  ])("keeps newer edits protected after $operation completes (inactive: $inactive)", async ({ operation, inactive }) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, shell } = await setup();
    let complete: (value: ShellResult<ShellSaveOk>) => void = () => {};
    const nativeSave = operation === "Save" ? shell.saveFile : shell.saveFileAs;
    vi.mocked(nativeSave).mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    if (operation === "Save") {
      await act(async () => { await result.current.workingModeBarProps.onOpen(); });
    } else {
      act(() => result.current.callbacks.onNewDocument());
    }
    const entryId = result.current.selectedEntry!.id;
    act(() => result.current.callbacks.onMarkdownChange("Snapshot A"));
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(nativeSave).toHaveBeenCalledOnce());
    expect(nativeSave).toHaveBeenCalledWith(expect.objectContaining({ content: "Snapshot A" }));
    act(() => result.current.callbacks.onMarkdownChange("Newer edits B"));
    if (inactive) act(() => result.current.callbacks.onNewDocument());
    await act(async () => { complete({ ok: true, path: "/mock/Untitled.md", mtimeMs: 2 }); });
    expect(result.current.fileListProps.saveStatuses?.[entryId]).toBe("edited");
    act(() => result.current.fileListProps.onToggleAllChecked());
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.fileListProps.entries.find((entry) => entry.id === entryId)?.editedMarkdown).toBe("Newer edits B");

    // A successful write still updates native path/mtime for the next save.
    vi.mocked(shell.statFile).mockResolvedValue({ ok: true, path: "/mock/Untitled.md", mtimeMs: 2 });
    await act(async () => { result.current.fileListProps.onSelect(entryId); });
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(result.current.previewPanelSaveProps.saveState).toBe("saved"));
    expect(shell.saveFile).toHaveBeenLastCalledWith(expect.objectContaining({
      content: "Newer edits B", expectedMtimeMs: 2, path: "/mock/Untitled.md",
    }));
  });

  it.each(["Save", "Save As"])("keeps edits made during cancelled %s protected", async (operation) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, shell } = await setup();
    let complete: (value: ShellResult<ShellSaveOk>) => void = () => {};
    const nativeSave = operation === "Save" ? shell.saveFile : shell.saveFileAs;
    vi.mocked(nativeSave).mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    if (operation === "Save As") {
      vi.mocked(shell.openFile).mockResolvedValue({
        ok: true, kind: "markdown", path: "/mock/Untitled.markdown",
        content: "Original saved text", mtimeMs: 1, lineEnding: "lf",
      });
    }
    await act(async () => { await result.current.workingModeBarProps.onOpen(); });
    expect(result.current.previewPanelSaveProps.saveState).toBe("saved");
    act(() => { void result.current.previewPanelSaveProps.onSave?.(); });
    await waitFor(() => expect(nativeSave).toHaveBeenCalledOnce());
    act(() => result.current.callbacks.onMarkdownChange("Typed while saving"));
    await act(async () => { complete({ ok: false, code: "cancelled" }); });
    expect(result.current.previewPanelSaveProps.saveState).toBe("edited");
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.selectedEntry?.editedMarkdown).toBe("Typed while saving");
  });
});

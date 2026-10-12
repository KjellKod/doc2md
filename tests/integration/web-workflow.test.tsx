import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWebAppShellAdapter } from "../../src/shell/webAdapter";
import { downloadEntry } from "../../src/utils/download";

vi.mock("../../src/utils/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/download")>()),
  downloadEntry: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

function setupDraft(text = "") {
  const hook = renderHook(() => useWebAppShellAdapter());
  act(() => hook.result.current.callbacks.onNewDocument());
  if (text) act(() => hook.result.current.callbacks.onMarkdownChange(text));
  return hook;
}

describe("browser document workflow", () => {
  it("starts drafts in working mode and supports returning from the intro", () => {
    const { result } = setupDraft();
    expect(result.current.isWorkingMode).toBe(true);
    act(() => result.current.callbacks.onReturnHome());
    expect(result.current.isWorkingMode).toBe(false);
    act(() => result.current.callbacks.onCollapseFromHero());
    expect(result.current.isWorkingMode).toBe(true);
    act(() => result.current.callbacks.onReturnHome());
    act(() => result.current.callbacks.onNewDocument());
    expect(result.current.isWorkingMode).toBe(true);
  });

  it("preserves an edited draft when discard is cancelled and clears on acceptance", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setupDraft("Only copy");
    const id = result.current.selectedEntry!.id;
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.selectedEntry?.id).toBe(id);
    expect(result.current.selectedEntry?.editedMarkdown).toBe("Only copy");
    confirm.mockReturnValue(true);
    act(() => result.current.fileListProps.onClear());
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  it("checks inactive edited entries in a mixed batch and preserves selection on cancellation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setupDraft("First draft");
    const dirtyId = result.current.selectedEntry!.id;
    act(() => result.current.callbacks.onNewDocument());
    const activeId = result.current.selectedEntry!.id;
    act(() => result.current.fileListProps.onToggleAllChecked());
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.fileListProps.entries).toHaveLength(2);
    expect(result.current.fileListProps.checkedIds).toEqual(new Set([dirtyId, activeId]));
    expect(result.current.selectedEntry?.id).toBe(activeId);
  });

  it("clears untouched empty drafts without a confirmation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setupDraft();
    act(() => result.current.fileListProps.onClear());
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  it("clears unmodified imported files without a confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useWebAppShellAdapter());
    act(() => result.current.dropZoneProps.onFilesAdded([
      new File(["Original document"], "original.txt", { type: "text/plain" }),
    ]));
    await waitFor(() => expect(result.current.selectedEntry?.status).toBe("success"));
    act(() => result.current.fileListProps.onClear());
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  it("downloads every checked snapshot and leaves them safe to clear", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setupDraft("First document");
    act(() => result.current.callbacks.onNewDocument());
    act(() => result.current.callbacks.onMarkdownChange("Second document"));
    act(() => result.current.fileListProps.onToggleAllChecked());
    await act(async () => { await result.current.fileListProps.onDownload(); });
    act(() => result.current.fileListProps.onToggleAllChecked());
    act(() => result.current.fileListProps.onClear());
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.fileListProps.entries).toHaveLength(0);
  });

  it.each(["primary", "markdown", "sidebar"] as const)(
    "%s download updates the current snapshot status",
    async (action) => {
      const { result } = setupDraft("Download this");
      await act(async () => {
        if (action === "primary") await result.current.previewPanelSaveProps.onSave?.();
        else if (action === "markdown") await result.current.previewPanelSaveProps.onDownloadMarkdown();
        else await result.current.fileListProps.onDownload();
      });
      expect(result.current.previewPanelSaveProps.saveState).toBe("saved");
      expect(result.current.previewPanelSaveProps.lastSavedAt).toEqual(expect.any(Number));
    },
  );

  it("protects a pending download and keeps edits made during it marked undownloaded", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = setupDraft("Original snapshot");
    let pending: void | Promise<void>;
    act(() => { pending = result.current.previewPanelSaveProps.onSave?.(); });
    expect(result.current.previewPanelSaveProps.saveState).toBe("saving");
    act(() => result.current.fileListProps.onClear());
    expect(confirm).toHaveBeenCalledOnce();
    expect(result.current.selectedEntry).not.toBeNull();
    act(() => result.current.callbacks.onMarkdownChange("Newer edits"));
    await act(async () => { await pending; });
    expect(result.current.previewPanelSaveProps.saveState).toBe("edited");
    expect(vi.mocked(downloadEntry).mock.lastCall?.[0].editedMarkdown).toBe("Original snapshot");
  });

  it("records an inactive download without overwriting the newly selected document status", async () => {
    const { result } = setupDraft("First snapshot");
    const firstId = result.current.selectedEntry!.id;
    let pending: void | Promise<void>;
    act(() => { pending = result.current.previewPanelSaveProps.onDownloadMarkdown(); });
    act(() => result.current.callbacks.onNewDocument());
    act(() => result.current.callbacks.onMarkdownChange("Second edits"));
    await act(async () => { await pending; });
    expect(result.current.previewPanelSaveProps.saveState).toBe("edited");
    act(() => result.current.fileListProps.onSelect(firstId));
    await waitFor(() => expect(result.current.previewPanelSaveProps.saveState).toBe("saved"));
    expect(result.current.previewPanelSaveProps.lastSavedAt).toEqual(expect.any(Number));
  });
});

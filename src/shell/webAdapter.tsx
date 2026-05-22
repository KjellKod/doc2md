// AppShell dedup Phase 2 — hosted web adapter.
//
// Wires hosted-browser-only behavior into the shared AppShell:
// - browser file input (hidden input + browse trigger)
// - download save behavior
// - browser theme persistence variant (lives in ThemeProvider; web adapter
//   does not re-implement it here)
// - browser WorkingModeBar slot
//
// Negative check (per Phase 2 brief): Sparkle and license UI live in
// apps/macos/**, NOT in the React shell. This adapter does not render any
// updater UI.

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BROWSER_FILE_ACCEPT } from "../components/DropZone";
import type { DropZoneProps } from "../components/DropZone";
import ThemeToggle from "../components/ThemeToggle";
import type { WorkingModeBarProps } from "../components/WorkingModeBar";
import { useFileConversion } from "../hooks/useFileConversion";
import { useSaveState } from "../hooks/useSaveState";
import type {
  AppShellCallbacks,
  AppShellFileListProps,
  AppShellPreviewPanelSaveProps,
  PageView,
} from "./AppShell";
import { useWorkspaceResize } from "./useWorkspaceResize";
import type { FileEntry } from "../types";
import type { SaveState } from "../types/saveState";
import { downloadEntry, isDownloadableEntry } from "../utils/download";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export type WebAppShellAdapter = {
  resize: ReturnType<typeof useWorkspaceResize>;
  activePage: PageView;
  setActivePage: (page: PageView) => void;
  isWorkingMode: boolean;
  hasWorkingEntry: boolean;
  heroSummary: string;
  fileSummary: string;
  selectedEntry: FileEntry | null;
  editorFocusRequest: { id: number; target: "editor" };
  callbacks: AppShellCallbacks;
  previewPanelSaveProps: AppShellPreviewPanelSaveProps;
  fileListProps: AppShellFileListProps;
  workingModeBarProps: WorkingModeBarProps;
  heroActionsSlot: ReactNode;
  dropZoneProps: DropZoneProps;
  desktopStatusSlot: ReactNode;
  hiddenInputSlot: ReactNode;
  nativeMenuBridgeSlot: ReactNode;
};

export function useWebAppShellAdapter(): WebAppShellAdapter {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [showLandingChrome, setShowLandingChrome] = useState(false);
  const previousSelectedEntryIdRef = useRef<string | null>(null);
  const browserFileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    entries,
    addFiles,
    addUrl,
    addScratchEntry,
    clearEntriesById,
    selectEntry,
    selectedEntry,
    updateMarkdown,
  } = useFileConversion();
  const saveState = useSaveState();
  const resize = useWorkspaceResize();
  const activeEntryIdRef = useRef<string | null>(null);
  const saveStateRef = useRef<SaveState>(saveState.state);
  const entriesRef = useRef<FileEntry[]>([]);
  const [checkedEntryIds, setCheckedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pastePromotedEntryIds, setPastePromotedEntryIds] = useState<
    Set<string>
  >(() => new Set());
  const [entrySaveStates, setEntrySaveStates] = useState<
    Record<string, SaveState>
  >({});
  const [entryLastSavedAt, setEntryLastSavedAt] = useState<
    Record<string, number>
  >({});
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    id: number;
    target: "editor";
  }>({ id: 0, target: "editor" });

  const selectedEntryId = selectedEntry?.id ?? null;
  const hasWorkingEntry =
    selectedEntry !== null &&
    (!selectedEntry.isScratch || pastePromotedEntryIds.has(selectedEntry.id));
  const isWorkingMode = hasWorkingEntry && !showLandingChrome;

  let convertedCount = 0;
  let draftCount = 0;
  let activeCount = 0;
  for (const entry of entries) {
    if (isDownloadableEntry(entry) && !entry.isScratch) convertedCount++;
    if (entry.isScratch) draftCount++;
    if (entry.status === "pending" || entry.status === "converting")
      activeCount++;
  }

  const buildSummary = (emptyLabel: string, draftSuffix: string) => {
    if (entries.length === 0) return emptyLabel;
    return (
      [
        convertedCount > 0
          ? `${convertedCount} ${pluralize(convertedCount, "converted file")}`
          : null,
        activeCount > 0 ? `${activeCount} processing` : null,
        draftCount > 0
          ? `${draftCount} ${pluralize(draftCount, "draft")}${draftSuffix}`
          : null,
      ]
        .filter(Boolean)
        .join(", ") ||
      `${entries.length} ${pluralize(entries.length, "entry")} in session`
    );
  };
  const heroSummary = buildSummary(
    "Start writing, open files, or import a direct document URL",
    " open",
  );
  const fileSummary = buildSummary(
    "Converted files and drafts stay in this list.",
    "",
  );

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    const liveEntryIds = new Set(entries.map((entry) => entry.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prune-stale-keys
    setEntrySaveStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    setEntryLastSavedAt((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    setPastePromotedEntryIds((current) => {
      const liveScratchEntryIds = new Set(
        entries.filter((entry) => entry.isScratch).map((entry) => entry.id),
      );
      const next = new Set(
        Array.from(current).filter((entryId) =>
          liveScratchEntryIds.has(entryId),
        ),
      );
      const unchanged =
        next.size === current.size &&
        Array.from(next).every((entryId) => current.has(entryId));
      return unchanged ? current : next;
    });
  }, [entries]);

  useEffect(() => {
    const previousEntryId = activeEntryIdRef.current;
    if (previousEntryId === selectedEntryId) {
      return;
    }
    const previousEntryStillExists =
      previousEntryId &&
      entriesRef.current.some((entry) => entry.id === previousEntryId);
    if (previousEntryStillExists) {
      setEntrySaveStates((current) => ({
        ...current,
        [previousEntryId]: saveStateRef.current,
      }));
    }
    activeEntryIdRef.current = selectedEntryId;
    saveState.restore(
      selectedEntryId ? (entrySaveStates[selectedEntryId] ?? "saved") : "saved",
    );
  }, [entrySaveStates, saveState, selectedEntryId]);

  useEffect(() => {
    saveStateRef.current = saveState.state;
  }, [saveState.state]);

  useEffect(() => {
    if (selectedEntryId !== null && !selectedEntry?.isScratch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close-on-select
      setShowLandingChrome(false);
    }
  }, [selectedEntry?.isScratch, selectedEntryId]);

  const setEntrySaveState = useCallback(
    (entryId: string, nextState: SaveState) => {
      setEntrySaveStates((current) => ({
        ...current,
        [entryId]: nextState,
      }));
      if (activeEntryIdRef.current === entryId) {
        saveState.restore(nextState);
      }
    },
    [saveState],
  );

  useEffect(() => {
    const previous = previousSelectedEntryIdRef.current;
    previousSelectedEntryIdRef.current = selectedEntryId;
    if (previous !== null || selectedEntryId === null) {
      return;
    }
    resize.triggerFirstOpenAutoCollapse(Boolean(selectedEntry?.isScratch));
  }, [resize, selectedEntry?.isScratch, selectedEntryId]);

  async function handleUrlAdded(url: string) {
    await addUrl(url);
  }

  const toggleCheckedEntry = useCallback((entryId: string, checked: boolean) => {
    setCheckedEntryIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(entryId);
      } else {
        next.delete(entryId);
      }
      return next;
    });
  }, []);

  const toggleAllChecked = useCallback(() => {
    setCheckedEntryIds((current) => {
      const allChecked =
        entries.length > 0 && entries.every((entry) => current.has(entry.id));
      if (allChecked) {
        return new Set();
      }
      return new Set(entries.map((entry) => entry.id));
    });
  }, [entries]);

  const checkedTargets = entries.filter((entry) => checkedEntryIds.has(entry.id));

  const handleDownload = useCallback(() => {
    const targets =
      checkedTargets.length > 0
        ? checkedTargets
        : selectedEntry
          ? [selectedEntry]
          : [];
    for (const entry of targets) {
      if (isDownloadableEntry(entry)) {
        downloadEntry(entry);
      }
    }
    setCheckedEntryIds(new Set());
  }, [checkedTargets, selectedEntry]);

  const handleClear = useCallback(() => {
    const targets =
      checkedTargets.length > 0
        ? checkedTargets
        : selectedEntry
          ? [selectedEntry]
          : [];
    const targetIds = targets.map((entry) => entry.id);
    if (targetIds.length === 0) {
      return;
    }
    clearEntriesById(targetIds);
    setCheckedEntryIds(new Set());
  }, [checkedTargets, clearEntriesById, selectedEntry]);

  const handleNewDocument = useCallback(() => {
    const entryId = addScratchEntry();
    setEntrySaveStates((current) => ({
      ...current,
      [entryId]: "saved",
    }));
    setActivePage("convert");
    setEditorFocusRequest(({ id }) => ({ id: id + 1, target: "editor" }));
  }, [addScratchEntry]);

  const handleLargeMarkdownPaste = useCallback(() => {
    if (!selectedEntry?.isScratch) {
      return;
    }
    setPastePromotedEntryIds((current) => {
      if (current.has(selectedEntry.id)) {
        return current;
      }
      const next = new Set(current);
      next.add(selectedEntry.id);
      return next;
    });
    setShowLandingChrome(false);
  }, [selectedEntry]);

  const handleSelectEntry = useCallback(
    (entryId: string) => {
      selectEntry(entryId);
    },
    [selectEntry],
  );

  const handleReturnHome = useCallback(() => {
    setShowLandingChrome(true);
    setActivePage("convert");
  }, []);

  const handleCollapseFromHero = useCallback(() => {
    if (!hasWorkingEntry) {
      return;
    }
    setShowLandingChrome(false);
  }, [hasWorkingEntry]);

  const handleBrowserOpenRequest = useCallback(() => {
    browserFileInputRef.current?.click();
  }, []);

  const handleBrowserFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
      event.target.value = "";
    },
    [addFiles],
  );

  const handleSave = useCallback(() => {
    if (!isDownloadableEntry(selectedEntry)) {
      return;
    }
    saveState.markSaving();
    downloadEntry(selectedEntry);
    setEntrySaveState(selectedEntry.id, "saved");
    setEntryLastSavedAt((current) => ({
      ...current,
      [selectedEntry.id]: Date.now(),
    }));
    saveState.markSaved();
  }, [saveState, selectedEntry, setEntrySaveState]);

  const handleMarkdownChange = useCallback(
    (text: string) => {
      if (selectedEntry) {
        updateMarkdown(selectedEntry.id, text);
        setEntrySaveState(selectedEntry.id, "edited");
      }
    },
    [selectedEntry, setEntrySaveState, updateMarkdown],
  );

  useEffect(() => {
    const dirty = Object.values(entrySaveStates).some(
      (state) => state === "edited",
    );
    if (!dirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [entrySaveStates]);

  const saveButtonBusy = saveState.state === "saving";
  const saveButtonDisabled = !isDownloadableEntry(selectedEntry) || saveButtonBusy;

  const callbacks: AppShellCallbacks = {
    onNewDocument: handleNewDocument,
    onReturnHome: handleReturnHome,
    onCollapseFromHero: handleCollapseFromHero,
    onLargeMarkdownPaste: handleLargeMarkdownPaste,
    onMarkdownChange: handleMarkdownChange,
  };

  const previewPanelSaveProps: AppShellPreviewPanelSaveProps = {
    saveState: saveState.state,
    saveBusy: saveButtonBusy,
    saveDisabled: saveButtonDisabled,
    lastSavedAt: selectedEntry
      ? (entryLastSavedAt[selectedEntry.id] ?? null)
      : null,
    onSave: handleSave,
  };

  const fileListProps: AppShellFileListProps = {
    entries,
    checkedIds: checkedEntryIds,
    onCheckedChange: toggleCheckedEntry,
    onClear: handleClear,
    onDownload: handleDownload,
    onSelect: handleSelectEntry,
    onToggleAllChecked: toggleAllChecked,
  };

  const workingModeBarProps: WorkingModeBarProps = {
    variant: "browser",
    onHome: handleReturnHome,
    onOpen: handleBrowserOpenRequest,
    onNew: handleNewDocument,
    trailingControls: <ThemeToggle />,
  };

  const heroActionsSlot = <ThemeToggle />;

  const dropZoneProps: DropZoneProps = {
    onFilesAdded: addFiles,
    onUrlAdded: handleUrlAdded,
    onBrowseRequest: handleBrowserOpenRequest,
  };

  const hiddenInputSlot = (
    <input
      ref={browserFileInputRef}
      className="visually-hidden"
      type="file"
      accept={BROWSER_FILE_ACCEPT}
      multiple
      onChange={handleBrowserFileInputChange}
    />
  );

  return {
    resize,
    activePage,
    setActivePage,
    isWorkingMode,
    hasWorkingEntry,
    heroSummary,
    fileSummary,
    selectedEntry,
    editorFocusRequest,
    callbacks,
    previewPanelSaveProps,
    fileListProps,
    workingModeBarProps,
    heroActionsSlot,
    dropZoneProps,
    desktopStatusSlot: null,
    hiddenInputSlot,
    nativeMenuBridgeSlot: null,
  };
}

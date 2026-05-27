// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
//
// AppShell dedup Phase 2 — desktop adapter.
//
// Wires desktop-only behavior into the shared AppShell:
// - native menu bridge (DesktopMenuBridge slot)
// - desktop save state machine (lives in src/desktop/useDesktopSaveState;
//   surfaced via previewPanelSaveProps and the desktopStatusSlot save pill)
// - conflict bar slot (inside desktopStatusSlot)
// - native open/save/saveAs/reload/reveal callbacks
// - persistence (recent files, theme, session restore)
// - settings popover (settingsControlSlot, rendered into heroActionsSlot
//   when landing and trailing controls when in working mode)
// - import handoff UI (notice + desktop status bar)
// - WorkingModeBar desktop variant with recent files
//
// Negative check (per Phase 2 brief): Sparkle and license UI live in
// apps/macos/**, NOT in this React shell. This adapter does not render any
// updater UI or license UI. The src/desktop/LICENSE file is a text asset,
// not React.

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { DropZoneProps } from "../components/DropZone";
import ThemeToggle from "../components/ThemeToggle";
import type { WorkingModeBarProps } from "../components/WorkingModeBar";
import { useFileConversion } from "../hooks/useFileConversion";
import { useTheme } from "../hooks/useTheme";
import { useWorkspaceResize } from "./useWorkspaceResize";
import type { FileEntry } from "../types";
import type {
  DesktopPersistenceSettings,
  DesktopSessionState,
  ShellFile,
  ShellConflict,
  ShellError,
  ShellLineEnding,
  ShellOpenMarkdownOk,
  ShellPermissionNeeded,
  ShellResult,
} from "../types/doc2mdShell";
import type { Theme } from "../types/theme";
import {
  downloadEntry,
  isDownloadableEntry,
} from "../utils/download";
import type { DesktopSaveState } from "../desktop/saveState";
import { useDesktopCapability } from "../desktop/useDesktopCapability";
import { useDesktopSaveState } from "../desktop/useDesktopSaveState";
import { useNativeMenuEvents } from "../desktop/useNativeMenuEvents";
import type {
  AppShellCallbacks,
  AppShellFileListProps,
  AppShellPreviewPanelSaveProps,
  PageView,
} from "./AppShell";
const CONVERSION_FAILED_SAVE_MESSAGE =
  "Cannot save because conversion failed. Re-open the source file or choose another document.";
const PERSISTENCE_UNAVAILABLE_MESSAGE =
  "Desktop persistence settings are unavailable. You can keep working, but recents and restore may not update.";
const DEFAULT_DESKTOP_PERSISTENCE_SETTINGS: DesktopPersistenceSettings = {
  ok: true,
  persistenceEnabled: false,
  recentFiles: [],
};
const SESSION_SYNC_DEBOUNCE_MS = 150;

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function markdownForEntry(entry: FileEntry | null) {
  return entry?.editedMarkdown ?? entry?.markdown ?? "";
}

function suggestedNameForEntry(entry: FileEntry | null) {
  return entry?.name || "Untitled.md";
}

function basenameForPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path || "Untitled.md";
}

function addSentenceFollowUp(message: string, followUp: string) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return followUp;
  }

  const separator = /[.!?:;]$/.test(trimmedMessage) ? " " : ". ";
  return `${trimmedMessage}${separator}${followUp}`;
}

function reloadFailureMessage(message: string) {
  return `Unable to reload file from disk: ${addSentenceFollowUp(
    message,
    "Check the file, then try Reload again.",
  )}`;
}

type DesktopFileMetadata = {
  path: string;
  mtimeMs: number;
  lineEnding: ShellLineEnding;
};

function lineEndingForDesktopFile(
  metadata: DesktopFileMetadata | undefined,
): ShellLineEnding {
  return metadata?.lineEnding ?? "lf";
}

type DesktopNotice =
  | { kind: "none" }
  | { kind: "info"; message: string }
  | { kind: "permission-needed"; message: string; path?: string }
  | { kind: "error"; message: string };

type PendingConflict = ShellConflict & {
  entryId: string;
  lineEnding: ShellLineEnding;
  source: "save" | "stat";
};

const NO_DESKTOP_NOTICE: DesktopNotice = { kind: "none" };

function omitRecordKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

const IMPORT_HANDOFF_EXPIRED_MESSAGE =
  "Import handoff expired. Open the file again from the File menu.";
const IMPORT_HANDOFF_FAILED_MESSAGE =
  "Import failed before the app received the file bytes. Open the file again, or choose another supported file.";

function noticeFromPermission(result: ShellPermissionNeeded): DesktopNotice {
  return {
    kind: "permission-needed",
    path: result.path,
    message: result.message,
  };
}

function noticeFromError(result: ShellError): DesktopNotice {
  return {
    kind: "error",
    message: result.message,
  };
}

function noticeFromPersistenceIssue(
  result: ShellResult<{ ok: true }>,
): DesktopNotice {
  if (result.ok) {
    return { kind: "none" };
  }

  if (result.code === "permission-needed") {
    return noticeFromPermission(result);
  }

  if (result.code === "error") {
    return noticeFromError(result);
  }

  return {
    kind: "error",
    message: PERSISTENCE_UNAVAILABLE_MESSAGE,
  };
}

function isPersistenceSettings(
  result: ShellResult<DesktopPersistenceSettings>,
): result is DesktopPersistenceSettings {
  return result.ok;
}

function isSessionState(
  result: ShellResult<DesktopSessionState>,
): result is DesktopSessionState {
  return result.ok;
}

function mergeDesktopRecentFiles(
  primary: DesktopPersistenceSettings["recentFiles"],
  fallback: DesktopPersistenceSettings["recentFiles"],
): DesktopPersistenceSettings["recentFiles"] {
  const seen = new Set<string>();
  const merged: DesktopPersistenceSettings["recentFiles"] = [];

  for (const file of [...primary, ...fallback]) {
    if (seen.has(file.path)) {
      continue;
    }

    seen.add(file.path);
    merged.push(file);
  }

  return merged;
}

async function readImportFailureMessage(
  importResponse: Response,
): Promise<string> {
  if (importResponse.status === 404) {
    return IMPORT_HANDOFF_EXPIRED_MESSAGE;
  }

  if (importResponse.status !== 413) {
    return IMPORT_HANDOFF_FAILED_MESSAGE;
  }

  try {
    const message = (await importResponse.text()).trim();
    return message || IMPORT_HANDOFF_FAILED_MESSAGE;
  } catch {
    return IMPORT_HANDOFF_FAILED_MESSAGE;
  }
}

function DesktopMenuBridge({
  isDesktop,
  handlers,
}: {
  isDesktop: boolean;
  handlers: Parameters<typeof useNativeMenuEvents>[0];
}) {
  if (!isDesktop) {
    return null;
  }

  return <DesktopMenuEventBridge handlers={handlers} />;
}

function DesktopMenuEventBridge({
  handlers,
}: {
  handlers: Parameters<typeof useNativeMenuEvents>[0];
}) {
  useNativeMenuEvents(handlers);

  return <span data-testid="desktop-menu-bridge" hidden />;
}

export type DesktopAppShellAdapter = {
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
  heroClassExtension?: string;
};

export function useDesktopAppShellAdapter(): DesktopAppShellAdapter {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [showLandingChrome, setShowLandingChrome] = useState(false);
  const previousSelectedEntryIdRef = useRef<string | null>(null);
  const resize = useWorkspaceResize();
  // AppShell owns the convert/install tab refs and the tab keyboard
  // navigation. The adapter does not render them.
  const {
    entries,
    addFiles,
    addScratchEntry,
    addMarkdownEntry,
    addImportedFileEntry,
    clearEntriesById,
    replaceEntryWithMarkdownFile,
    renameEntry,
    selectEntry,
    selectedEntry,
    updateMarkdown,
    discardEditedMarkdown,
  } = useFileConversion();
  const { isDesktop, shell } = useDesktopCapability();
  const saveState = useDesktopSaveState(isDesktop);
  const { theme, setTheme } = useTheme();
  const saveInFlightRef = useRef(false);
  const recentOpenInFlightPathsRef = useRef<Set<string>>(new Set());
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const restoredThemeRef = useRef<Theme | null>(null);
  const themeBaselineRef = useRef<Theme>(theme);
  const currentThemeRef = useRef<Theme>(theme);
  const activeEntryIdRef = useRef<string | null>(null);
  const entriesRef = useRef<FileEntry[]>([]);
  const desktopFilesRef = useRef<Record<string, DesktopFileMetadata>>({});
  const saveStateRef = useRef<DesktopSaveState>(saveState.state);
  const [desktopNotice, setDesktopNotice] = useState<DesktopNotice>({
    kind: "none",
  });
  const [documentNotices, setDocumentNotices] = useState<
    Record<string, DesktopNotice>
  >({});
  const [pendingConflicts, setPendingConflicts] = useState<
    Record<string, PendingConflict>
  >({});
  const pendingConflictsRef = useRef<Record<string, PendingConflict>>({});
  const sessionRestoreStartedRef = useRef(false);
  const sessionRestoreInFlightRef = useRef(false);
  const sessionRestoreCompletedRef = useRef(false);
  const sessionSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sessionSyncSuppressedPathsRef = useRef<Set<string>>(new Set());
  const [entrySaveStates, setEntrySaveStates] = useState<
    Record<string, DesktopSaveState>
  >({});
  const [entryLastSavedAt, setEntryLastSavedAt] = useState<
    Record<string, number>
  >({});
  const [desktopFiles, setDesktopFiles] = useState<
    Record<string, DesktopFileMetadata>
  >({});
  const [checkedEntryIds, setCheckedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  // Scratch entries that the user has paste-promoted into a real working
  // document. Mirrors the same state in webAdapter so a desktop user who
  // pastes a large markdown blob into a fresh draft gets the small-header
  // working-mode chrome instead of staying stuck on the hero. Cleaned up
  // when the underlying scratch leaves the entry list (see the pruning
  // useEffect below).
  const [pastePromotedEntryIds, setPastePromotedEntryIds] = useState<
    Set<string>
  >(() => new Set());
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false);
  const [unavailableRecentPaths, setUnavailableRecentPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [persistenceSettings, setPersistenceSettings] =
    useState<DesktopPersistenceSettings>(DEFAULT_DESKTOP_PERSISTENCE_SETTINGS);
  const [initialPersistenceLoaded, setInitialPersistenceLoaded] =
    useState(false);
  const [sessionRestoreRevision, setSessionRestoreRevision] = useState(0);
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
    "Start writing or open files from your device",
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
    desktopFilesRef.current = desktopFiles;
  }, [desktopFiles]);

  useEffect(() => {
    pendingConflictsRef.current = pendingConflicts;
  }, [pendingConflicts]);

  // Working-mode auto-collapse: same one-shot semantics as the hosted App,
  // delegated to the shared hook so the Mac shell collapses the upload chrome
  // on the user's first non-scratch open.
  useEffect(() => {
    const previous = previousSelectedEntryIdRef.current;
    previousSelectedEntryIdRef.current = selectedEntryId;

    if (previous !== null || selectedEntryId === null) {
      return;
    }
    resize.triggerFirstOpenAutoCollapse(Boolean(selectedEntry?.isScratch));
  }, [resize, selectedEntry?.isScratch, selectedEntryId]);

  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);

  // Prune five per-entry maps when an entry is removed. The functional
  // updaters return the same reference when no entry was removed, so React
  // bails out and there is no cascading render in practice. Same pattern
  // as the hosted App.tsx.
  useEffect(() => {
    const liveEntryIds = new Set(entries.map((entry) => entry.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prune-stale-keys (see comment above)
    setCheckedEntryIds((current) => {
      const next = new Set(
        [...current].filter((entryId) => liveEntryIds.has(entryId)),
      );

      return next.size === current.size ? current : next;
    });
    setEntrySaveStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    setDocumentNotices((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    setPendingConflicts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    setDesktopFiles((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => liveEntryIds.has(entryId)),
      ),
    );
    // Drop paste-promoted ids that no longer correspond to a live scratch
    // entry. Mirrors the same pruning step in webAdapter.
    setPastePromotedEntryIds((current) => {
      const liveScratchEntryIds = new Set(
        entries.filter((entry) => entry.isScratch).map((entry) => entry.id),
      );
      const next = new Set(
        [...current].filter((entryId) => liveScratchEntryIds.has(entryId)),
      );
      return next.size === current.size ? current : next;
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

  // Close the landing chrome when a non-scratch entry becomes selected.
  // Keep this in a post-commit effect (not a during-render guard) so the
  // user can later re-open the landing chrome via the eyebrow toggle while
  // an entry is still selected — a during-render guard would refire on the
  // next render and prevent the re-open. Same pattern as the hosted App.tsx.
  useEffect(() => {
    if (selectedEntryId !== null && !selectedEntry?.isScratch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close-on-select (see comment above)
      setShowLandingChrome(false);
    }
  }, [selectedEntry?.isScratch, selectedEntryId]);

  const setEntryDesktopSaveState = useCallback(
    (entryId: string, nextState: DesktopSaveState) => {
      setEntrySaveStates((current) => {
        const previous = current[entryId];
        // Stamp lastSavedAt only on a real save-state transition INTO "saved"
        // (edited → saved, saving → saved, conflict/error → saved). Do NOT
        // stamp when an entry was already "saved" — switching between
        // already-saved entries must not reset the relative-time pill.
        if (
          nextState === "saved" &&
          previous !== undefined &&
          previous !== "saved"
        ) {
          setEntryLastSavedAt((stamps) => ({
            ...stamps,
            [entryId]: Date.now(),
          }));
        }
        return {
          ...current,
          [entryId]: nextState,
        };
      });

      if (activeEntryIdRef.current === entryId) {
        saveState.restore(nextState);
      }
    },
    [saveState],
  );

  const removeEntryScopedDesktopState = useCallback((entryIds: string[]) => {
    const idsToRemove = new Set(entryIds);
    setEntrySaveStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => !idsToRemove.has(entryId)),
      ),
    );
    setDocumentNotices((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => !idsToRemove.has(entryId)),
      ),
    );
    setPendingConflicts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => !idsToRemove.has(entryId)),
      ),
    );
    setDesktopFiles((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => !idsToRemove.has(entryId)),
      ),
    );
    setEntryLastSavedAt((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([entryId]) => !idsToRemove.has(entryId)),
      ),
    );
  }, []);

  const showPersistenceUnavailable = useCallback(() => {
    setDesktopNotice({
      kind: "error",
      message: PERSISTENCE_UNAVAILABLE_MESSAGE,
    });
  }, []);

  const showPersistenceIssue = useCallback(
    (result: ShellResult<DesktopPersistenceSettings>) => {
      setDesktopNotice(noticeFromPersistenceIssue(result));
    },
    [],
  );

  const resetPersistenceLifecycleRefs = useCallback((baselineTheme: Theme) => {
    restoredThemeRef.current = null;
    themeBaselineRef.current = baselineTheme;
  }, []);

  useEffect(() => {
    if (!isDesktopSettingsOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        settingsPopoverRef.current?.contains(target)
      ) {
        return;
      }

      setIsDesktopSettingsOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isDesktopSettingsOpen]);

  // Shell-availability lifecycle: reset persistence UI when the shell
  // disappears, load persistence settings asynchronously when it appears.
  // Both branches are coupled to ref writes (resetPersistenceLifecycleRefs)
  // and an async load that flips multiple state values; effect is the
  // correct seam.
  useEffect(() => {
    if (!shell) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- shell-unavailable reset (see comment above)
      setPersistenceSettings(DEFAULT_DESKTOP_PERSISTENCE_SETTINGS);
      setInitialPersistenceLoaded(false);
      setIsDesktopSettingsOpen(false);
      sessionRestoreStartedRef.current = false;
      sessionRestoreInFlightRef.current = false;
      sessionRestoreCompletedRef.current = false;
      resetPersistenceLifecycleRefs(currentThemeRef.current);
      return;
    }

    let cancelled = false;
    const desktopShell = shell;
    sessionRestoreStartedRef.current = false;
    sessionRestoreInFlightRef.current = false;
    sessionRestoreCompletedRef.current = false;
    setInitialPersistenceLoaded(false);

    async function loadPersistenceSettings() {
      try {
        const result = await desktopShell.getPersistenceSettings();
        if (cancelled) {
          return;
        }

        if (isPersistenceSettings(result)) {
          setPersistenceSettings(result);
          resetPersistenceLifecycleRefs(
            result.persistenceEnabled && result.theme
              ? result.theme
              : currentThemeRef.current,
          );
          if (result.persistenceEnabled && result.theme) {
            restoredThemeRef.current = result.theme;
            setTheme(result.theme);
          }
          return;
        }

        showPersistenceIssue(result);
      } catch (error) {
        if (!cancelled) {
          showPersistenceUnavailable();
          console.error("doc2md desktop persistence load failure", error);
        }
      } finally {
        if (!cancelled) {
          setInitialPersistenceLoaded(true);
        }
      }
    }

    void loadPersistenceSettings();

    return () => {
      cancelled = true;
    };
  }, [
    resetPersistenceLifecycleRefs,
    setTheme,
    shell,
    showPersistenceIssue,
    showPersistenceUnavailable,
  ]);

  const refreshPersistenceSettings = useCallback(async () => {
    if (!shell) {
      return;
    }

    try {
      const result = await shell.getPersistenceSettings();
      if (isPersistenceSettings(result)) {
        setPersistenceSettings(result);
        return;
      }

      showPersistenceIssue(result);
    } catch (error) {
      showPersistenceUnavailable();
      console.error("doc2md desktop persistence refresh failure", error);
    }
  }, [shell, showPersistenceIssue, showPersistenceUnavailable]);

  useEffect(() => {
    if (
      !shell ||
      !initialPersistenceLoaded ||
      !persistenceSettings.persistenceEnabled
    ) {
      return;
    }

    if (restoredThemeRef.current === theme) {
      restoredThemeRef.current = null;
      themeBaselineRef.current = theme;
      return;
    }

    if (themeBaselineRef.current === theme || persistenceSettings.theme === theme) {
      return;
    }

    let cancelled = false;
    const desktopShell = shell;

    async function persistTheme() {
      try {
        const result = await desktopShell.setPersistenceTheme({ theme });
        if (cancelled) {
          return;
        }

        if (isPersistenceSettings(result)) {
          setPersistenceSettings(result);
          themeBaselineRef.current = theme;
          return;
        }

        showPersistenceIssue(result);
      } catch (error) {
        if (!cancelled) {
          showPersistenceUnavailable();
          console.error("doc2md desktop persistence theme failure", error);
        }
      }
    }

    void persistTheme();

    return () => {
      cancelled = true;
    };
  }, [
    initialPersistenceLoaded,
    persistenceSettings.persistenceEnabled,
    persistenceSettings.theme,
    shell,
    showPersistenceIssue,
    showPersistenceUnavailable,
    theme,
  ]);

  const handlePersistenceEnabledChange = useCallback(
    async (enabled: boolean) => {
      if (!shell) {
        return;
      }

      try {
        const result = await shell.setPersistenceEnabled({ enabled });
        if (isPersistenceSettings(result)) {
          const currentTheme = currentThemeRef.current;
          setPersistenceSettings(result);
          resetPersistenceLifecycleRefs(currentTheme);
          if (enabled && result.persistenceEnabled) {
            const themeResult = await shell.setPersistenceTheme({
              theme: currentTheme,
            });
            if (isPersistenceSettings(themeResult)) {
              setPersistenceSettings(themeResult);
              resetPersistenceLifecycleRefs(themeResult.theme ?? currentTheme);
              return;
            }

            showPersistenceIssue(themeResult);
          }
          return;
        }

        showPersistenceIssue(result);
      } catch (error) {
        showPersistenceUnavailable();
        console.error("doc2md desktop persistence toggle failure", error);
      }
    },
    [
      resetPersistenceLifecycleRefs,
      shell,
      showPersistenceIssue,
      showPersistenceUnavailable,
    ],
  );

  const handleDesktopSettingsKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    setIsDesktopSettingsOpen(false);
  };

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
    removeEntryScopedDesktopState(targetIds);
    setCheckedEntryIds(new Set());
  }, [
    checkedTargets,
    clearEntriesById,
    removeEntryScopedDesktopState,
    selectedEntry,
  ]);

  const selectedDesktopFile = selectedEntryId
    ? desktopFiles[selectedEntryId]
    : undefined;
  const selectedPath = selectedDesktopFile?.path;
  const desktopTitle = selectedPath
    ? basenameForPath(selectedPath)
    : suggestedNameForEntry(selectedEntry);
  const activeSaveState: DesktopSaveState = selectedEntryId
    ? (entrySaveStates[selectedEntryId] ?? saveState.state)
    : saveState.state;
  const activePendingConflict = selectedEntryId
    ? (pendingConflicts[selectedEntryId] ?? null)
    : null;
  const activeDocumentNotice: DesktopNotice = selectedEntryId
    ? (documentNotices[selectedEntryId] ?? NO_DESKTOP_NOTICE)
    : NO_DESKTOP_NOTICE;
  const visibleDesktopNotice: DesktopNotice =
    desktopNotice.kind === "none" ? activeDocumentNotice : desktopNotice;
  const saveStateLabels = {
    saved: "Saved",
    edited: "Unsaved",
    saving: "Saving",
    conflict: "Conflict",
    error: "Error",
    "permission-needed": "Permission needed",
  } as const;
  const saveStateLabel = saveStateLabels[activeSaveState];
  const showDesktopShellBar =
    isDesktop && (Boolean(selectedEntry) || desktopNotice.kind !== "none");
  const appReady =
    showDesktopShellBar &&
    Boolean(selectedEntry) &&
    Boolean(desktopTitle) &&
    Boolean(saveStateLabel);

  const clearDesktopProblem = useCallback(() => {
    setDesktopNotice({ kind: "none" });
  }, []);

  const allowSessionSyncForPath = useCallback((path: string) => {
    sessionSyncSuppressedPathsRef.current.delete(path);
  }, []);

  const suppressCurrentSessionPaths = useCallback(() => {
    sessionSyncSuppressedPathsRef.current = new Set(
      Object.values(desktopFilesRef.current).map((file) => file.path),
    );
  }, []);

  const handleClearRecentFiles = useCallback(async () => {
    if (!shell?.clearRecentFiles) {
      return;
    }

    try {
      const result = await shell.clearRecentFiles();
      if (isPersistenceSettings(result)) {
        if (sessionSyncTimeoutRef.current !== null) {
          clearTimeout(sessionSyncTimeoutRef.current);
          sessionSyncTimeoutRef.current = null;
        }
        suppressCurrentSessionPaths();
        void shell.setSessionState({
          openPaths: [],
          selectedPath: undefined,
        });
        setPersistenceSettings(result);
        setUnavailableRecentPaths(new Set());
        clearDesktopProblem();
        return;
      }

      showPersistenceIssue(result);
    } catch (error) {
      showPersistenceUnavailable();
      console.error("doc2md desktop recent-file clear failure", error);
    }
  }, [
    clearDesktopProblem,
    shell,
    showPersistenceIssue,
    showPersistenceUnavailable,
    suppressCurrentSessionPaths,
  ]);

  const markRecentPathAvailable = useCallback((path: string) => {
    setUnavailableRecentPaths((current) => {
      if (!current.has(path)) {
        return current;
      }

      const next = new Set(current);
      next.delete(path);
      return next;
    });
  }, []);

  const markRecentPathUnavailable = useCallback((path: string) => {
    setUnavailableRecentPaths((current) => {
      if (current.has(path)) {
        return current;
      }

      const next = new Set(current);
      next.add(path);
      return next;
    });
  }, []);

  const clearDocumentProblem = useCallback((entryId: string) => {
    setPendingConflicts((current) => omitRecordKey(current, entryId));
    setDocumentNotices((current) => omitRecordKey(current, entryId));
  }, []);

  const setDocumentNotice = useCallback(
    (entryId: string, notice: DesktopNotice) => {
      setDocumentNotices((current) => {
        if (notice.kind === "none") {
          return omitRecordKey(current, entryId);
        }

        return {
          ...current,
          [entryId]: notice,
        };
      });
    },
    [],
  );

  const refreshDesktopMetadataForEntry = useCallback(
    async (entry: FileEntry) => {
      const desktopFile = desktopFilesRef.current[entry.id];
      if (
        !shell ||
        !desktopFile ||
        entry.status === "pending" ||
        entry.status === "converting"
      ) {
        return;
      }

      const entryId = entry.id;
      const path = desktopFile.path;
      const rememberedMtimeMs = desktopFile.mtimeMs;

      try {
        const result = await shell.statFile({ path });
        const currentEntry = entriesRef.current.find(
          (candidate) => candidate.id === entryId,
        );
        const currentDesktopFile = desktopFilesRef.current[entryId];
        if (!currentEntry || currentDesktopFile?.path !== path) {
          return;
        }

        if (result.ok) {
          if (result.mtimeMs !== rememberedMtimeMs) {
            setPendingConflicts((current) => ({
              ...current,
              [entryId]: {
                ok: false,
                code: "conflict",
                path: result.path,
                actualMtimeMs: result.mtimeMs,
                entryId,
                lineEnding: currentDesktopFile.lineEnding,
                source: "stat",
              },
            }));
            setDocumentNotice(entryId, { kind: "none" });
            setEntryDesktopSaveState(entryId, "conflict");
            return;
          }

          if (pendingConflictsRef.current[entryId]?.source === "stat") {
            setPendingConflicts((current) => omitRecordKey(current, entryId));
            setEntryDesktopSaveState(entryId, "saved");
          }
          return;
        }

        if (result.code === "cancelled") {
          return;
        }

        if (result.code === "permission-needed") {
          setDocumentNotice(entryId, noticeFromPermission(result));
          setEntryDesktopSaveState(entryId, "permission-needed");
          return;
        }

        if (result.code === "error") {
          setDocumentNotice(entryId, noticeFromError(result));
          setEntryDesktopSaveState(entryId, "error");
        }
      } catch (error) {
        const currentEntry = entriesRef.current.find(
          (candidate) => candidate.id === entryId,
        );
        const currentDesktopFile = desktopFilesRef.current[entryId];
        if (!currentEntry || currentDesktopFile?.path !== path) {
          return;
        }

        setDocumentNotice(entryId, {
          kind: "error",
          message:
            "Could not check the file on disk. Re-open the file if the save state looks wrong.",
        });
        setEntryDesktopSaveState(entryId, "error");
        console.error("doc2md desktop statFile transport failure", error);
      }
    },
    [setDocumentNotice, setEntryDesktopSaveState, shell],
  );

  const handleSelectEntry = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      selectEntry(entryId);

      if (entry) {
        void refreshDesktopMetadataForEntry(entry);
      }
    },
    [entries, refreshDesktopMetadataForEntry, selectEntry],
  );

  const handleNewDocument = useCallback(() => {
    addScratchEntry();
    setActivePage("convert");
    setEditorFocusRequest(({ id }) => ({ id: id + 1, target: "editor" }));
  }, [addScratchEntry]);

  const handleReturnHome = useCallback(() => {
    setIsDesktopSettingsOpen(false);
    setShowLandingChrome(true);
    setActivePage("convert");
  }, []);

  const handleCollapseFromHero = useCallback(() => {
    if (!hasWorkingEntry) {
      return;
    }
    setIsDesktopSettingsOpen(false);
    setShowLandingChrome(false);
  }, [hasWorkingEntry]);

  const handleLargeMarkdownPaste = useCallback(() => {
    if (!selectedEntry?.isScratch) {
      return;
    }
    const scratchId = selectedEntry.id;
    setPastePromotedEntryIds((current) => {
      if (current.has(scratchId)) {
        return current;
      }
      const next = new Set(current);
      next.add(scratchId);
      return next;
    });
    setShowLandingChrome(false);
  }, [selectedEntry]);

  const handleOpenFileResult = useCallback(
    async (
      result: ShellResult<ShellFile>,
      options: { refreshPersistence?: boolean } = {},
    ): Promise<string | null> => {
      const refreshAfterOpen = options.refreshPersistence ?? true;
      if (result.ok) {
        if (result.kind === "markdown") {
          if (refreshAfterOpen) {
            allowSessionSyncForPath(result.path);
          }
          const entryId = addMarkdownEntry({
            name: basenameForPath(result.path),
            content: result.content,
            lastModified: result.mtimeMs,
          });
          setDesktopFiles((current) => ({
            ...current,
            [entryId]: {
              path: result.path,
              mtimeMs: result.mtimeMs,
              lineEnding: result.lineEnding,
            },
          }));
          clearDocumentProblem(entryId);
          setEntrySaveStates((current) => ({
            ...current,
            [entryId]: "saved",
          }));
          saveState.markSaved();
          clearDesktopProblem();
          if (refreshAfterOpen) {
            void refreshPersistenceSettings();
          }
          return entryId;
        }

        if (refreshAfterOpen) {
          void refreshPersistenceSettings();
        }

        if (window.location.protocol !== "doc2md:") {
          setDesktopNotice({
            kind: "info",
            message:
              "Importing non-Markdown files requires the Release desktop bundle. Run `npm run build:mac` or open the file from the installed app.",
          });
          return null;
        }

        const importResponse = await fetch(result.importUrl);
        if (!importResponse.ok) {
          const message = await readImportFailureMessage(importResponse);
          saveState.markError();
          setDesktopNotice({
            kind: "error",
            message,
          });
          return null;
        }

        const blob = await importResponse.blob();
        const file = new File([blob], result.name, {
          type: result.mimeType || blob.type || "application/octet-stream",
          lastModified: result.mtimeMs,
        });

        const entryId = addImportedFileEntry(file);
        setEntrySaveStates((current) => ({
          ...current,
          [entryId]: "edited",
        }));
        saveState.markEdited();
        clearDesktopProblem();
        return entryId;
      }

      if (result.code === "cancelled") {
        return null;
      }

      if (result.code === "permission-needed") {
        setDesktopNotice(noticeFromPermission(result));
        return null;
      }

      if (result.code === "error") {
        setDesktopNotice(noticeFromError(result));
      }
      return null;
    },
    [
      addImportedFileEntry,
      addMarkdownEntry,
      allowSessionSyncForPath,
      clearDesktopProblem,
      clearDocumentProblem,
      refreshPersistenceSettings,
      saveState,
    ],
  );
  const handleOpenFileResultRef = useRef(handleOpenFileResult);
  const selectEntryRef = useRef(selectEntry);

  useEffect(() => {
    handleOpenFileResultRef.current = handleOpenFileResult;
    selectEntryRef.current = selectEntry;
  }, [handleOpenFileResult, selectEntry]);

  const handleOpenFile = useCallback(async () => {
    if (!shell) {
      return;
    }

    try {
      const result = await shell.openFile();
      await handleOpenFileResult(result);
    } catch (error) {
      saveState.markError();
      setDesktopNotice({
        kind: "error",
        message:
          "Open failed before the app received a native result. Try opening the file again.",
      });
      console.error("doc2md desktop openFile transport failure", error);
    }
  }, [
    handleOpenFileResult,
    saveState,
    shell,
  ]);

  const handleOpenRecentFile = useCallback(
    async (path: string) => {
      if (!shell) {
        return false;
      }

      const existingEntry = entriesRef.current.find(
        (entry) => desktopFilesRef.current[entry.id]?.path === path,
      );
      if (existingEntry) {
        allowSessionSyncForPath(path);
        selectEntry(existingEntry.id);
        setActivePage("convert");
        setShowLandingChrome(false);
        markRecentPathAvailable(path);
        clearDesktopProblem();
        void refreshDesktopMetadataForEntry(existingEntry);
        return true;
      }

      if (recentOpenInFlightPathsRef.current.has(path)) {
        return false;
      }

      recentOpenInFlightPathsRef.current.add(path);
      try {
        const result = await shell.openFile({ path });
        await handleOpenFileResult(result);
        if (!result.ok && result.code !== "cancelled") {
          markRecentPathUnavailable(path);
          return false;
        }
        if (result.ok) {
          markRecentPathAvailable(path);
        }
        return result.ok;
      } catch (error) {
        markRecentPathUnavailable(path);
        saveState.markError();
        setDesktopNotice({
          kind: "error",
          message:
            "Open failed before the app received a native result. Try opening the recent file again.",
        });
        console.error("doc2md desktop openFile transport failure", error);
        return false;
      } finally {
        recentOpenInFlightPathsRef.current.delete(path);
      }
    },
    [
      allowSessionSyncForPath,
      clearDesktopProblem,
      handleOpenFileResult,
      markRecentPathAvailable,
      markRecentPathUnavailable,
      refreshDesktopMetadataForEntry,
      saveState,
      selectEntry,
      shell,
    ],
  );

  useEffect(() => {
    if (
      !shell ||
      !initialPersistenceLoaded ||
      !persistenceSettings.persistenceEnabled ||
      sessionRestoreStartedRef.current
    ) {
      if (
        initialPersistenceLoaded &&
        (!shell || !persistenceSettings.persistenceEnabled)
      ) {
        sessionRestoreCompletedRef.current = true;
      }
      return;
    }

    let cancelled = false;
    const desktopShell = shell;
    sessionRestoreStartedRef.current = true;
    sessionRestoreInFlightRef.current = true;
    sessionRestoreCompletedRef.current = false;

    async function restoreSession() {
      const restoredEntries: Array<{ path: string; entryId: string }> = [];
      let restoreCompleted = false;
      try {
        const sessionResult = await desktopShell.getSessionState();
        if (cancelled) {
          return;
        }

        if (!isSessionState(sessionResult)) {
          setDesktopNotice(noticeFromPersistenceIssue(sessionResult));
          return;
        }

        if (sessionResult.recentFiles.length > 0) {
          setPersistenceSettings((current) => ({
            ...current,
            recentFiles: mergeDesktopRecentFiles(
              sessionResult.recentFiles,
              current.recentFiles,
            ),
          }));
        }

        for (const path of sessionResult.openPaths) {
          const openResult = await desktopShell.openFile({ path });
          if (cancelled) {
            return;
          }

          const entryId = await handleOpenFileResultRef.current(openResult, {
            refreshPersistence: false,
          });
          if (entryId && openResult.ok && openResult.kind === "markdown") {
            restoredEntries.push({ path: openResult.path, entryId });
          }
        }

        const selectedRestoredEntry =
          sessionResult.selectedPath &&
          restoredEntries.find(
            (entry) => entry.path === sessionResult.selectedPath,
          );
        const fallbackRestoredEntry = restoredEntries[0];
        const entryToSelect = selectedRestoredEntry ?? fallbackRestoredEntry;
        if (entryToSelect) {
          selectEntryRef.current(entryToSelect.entryId);
        }
        restoreCompleted = true;
      } catch (error) {
        if (!cancelled) {
          setDesktopNotice({
            kind: "error",
            message:
              "Session restore failed before the app received a native result. Open a file or start a new draft.",
          });
          console.error("doc2md desktop session restore failure", error);
        }
      } finally {
        if (!cancelled) {
          sessionRestoreInFlightRef.current = false;
          if (restoreCompleted) {
            sessionRestoreCompletedRef.current = true;
            setSessionRestoreRevision((revision) => revision + 1);
          }
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [
    initialPersistenceLoaded,
    persistenceSettings.persistenceEnabled,
    shell,
  ]);

  useEffect(() => {
    if (
      !shell ||
      !initialPersistenceLoaded ||
      !persistenceSettings.persistenceEnabled ||
      !sessionRestoreCompletedRef.current ||
      sessionRestoreInFlightRef.current
    ) {
      return;
    }

    if (sessionSyncTimeoutRef.current !== null) {
      clearTimeout(sessionSyncTimeoutRef.current);
    }

    const desktopShell = shell;
    const openPaths = entries
      .map((entry) => desktopFiles[entry.id]?.path)
      .filter((path): path is string => Boolean(path))
      .filter((path) => !sessionSyncSuppressedPathsRef.current.has(path));
    const selectedPath = selectedEntryId
      ? desktopFiles[selectedEntryId]?.path
      : undefined;
    const selectedSessionPath =
      selectedPath && !sessionSyncSuppressedPathsRef.current.has(selectedPath)
        ? selectedPath
        : undefined;

    sessionSyncTimeoutRef.current = setTimeout(() => {
      void desktopShell.setSessionState({
        openPaths,
        selectedPath: selectedSessionPath,
      });
      sessionSyncTimeoutRef.current = null;
    }, SESSION_SYNC_DEBOUNCE_MS);

    return () => {
      if (sessionSyncTimeoutRef.current !== null) {
        clearTimeout(sessionSyncTimeoutRef.current);
        sessionSyncTimeoutRef.current = null;
      }
    };
  }, [
    desktopFiles,
    entries,
    initialPersistenceLoaded,
    persistenceSettings.persistenceEnabled,
    selectedEntryId,
    sessionRestoreRevision,
    shell,
  ]);

  const restoreCancelledSaveState = useCallback(
    (entryId: string, previousState: DesktopSaveState) => {
      setEntryDesktopSaveState(entryId, previousState);
    },
    [setEntryDesktopSaveState],
  );

  const saveEntryFile = useCallback(
    async (entry: FileEntry, expectedMtimeMs?: number) => {
      if (!shell || saveInFlightRef.current) {
        return;
      }

      const desktopFile = desktopFilesRef.current[entry.id];
      if (!desktopFile) {
        return;
      }

      const previousState = entrySaveStates[entry.id] ?? saveState.state;
      saveInFlightRef.current = true;
      setEntryDesktopSaveState(entry.id, "saving");

      try {
        const result = await shell.saveFile({
          path: desktopFile.path,
          content: markdownForEntry(entry),
          expectedMtimeMs: expectedMtimeMs ?? desktopFile.mtimeMs,
          lineEnding: lineEndingForDesktopFile(desktopFile),
        });

        if (result.ok) {
          const lineEnding = lineEndingForDesktopFile(desktopFile);
          allowSessionSyncForPath(result.path);
          renameEntry(entry.id, basenameForPath(result.path));
          setDesktopFiles((current) => ({
            ...current,
            [entry.id]: {
              path: result.path,
              mtimeMs: result.mtimeMs,
              lineEnding,
            },
          }));
          setEntryDesktopSaveState(entry.id, "saved");
          clearDocumentProblem(entry.id);
          void refreshPersistenceSettings();
          return;
        }

        if (result.code === "conflict") {
          setPendingConflicts((current) => ({
            ...current,
            [entry.id]: {
              ...result,
              entryId: entry.id,
              lineEnding: lineEndingForDesktopFile(desktopFile),
              source: "save",
            },
          }));
          setEntryDesktopSaveState(entry.id, "conflict");
          setDocumentNotice(entry.id, { kind: "none" });
          return;
        }

        if (result.code === "cancelled") {
          restoreCancelledSaveState(entry.id, previousState);
          return;
        }

        if (result.code === "permission-needed") {
          setEntryDesktopSaveState(entry.id, "permission-needed");
          setDocumentNotice(entry.id, noticeFromPermission(result));
          return;
        }

        setEntryDesktopSaveState(entry.id, "error");
        setDocumentNotice(entry.id, noticeFromError(result));
      } catch (error) {
        setEntryDesktopSaveState(entry.id, "error");
        setDocumentNotice(entry.id, {
          kind: "error",
          message:
            "Save failed before the app received a native result. Try Save again or choose Save As.",
        });
        console.error("doc2md desktop saveFile transport failure", error);
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [
      allowSessionSyncForPath,
      clearDocumentProblem,
      entrySaveStates,
      restoreCancelledSaveState,
      refreshPersistenceSettings,
      saveState,
      setEntryDesktopSaveState,
      setDocumentNotice,
      shell,
      renameEntry,
    ],
  );

  const handleSaveAs = useCallback(async () => {
    if (!shell || !selectedEntry || saveInFlightRef.current) {
      return;
    }

    const entry = selectedEntry;
    const previousState = entrySaveStates[entry.id] ?? saveState.state;
    if (entry.status === "pending" || entry.status === "converting") {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Finishing conversion. Try saving again in a moment.",
      });
      return;
    }
    if (entry.status === "error") {
      setDocumentNotice(entry.id, {
        kind: "error",
        message: CONVERSION_FAILED_SAVE_MESSAGE,
      });
      return;
    }
    saveInFlightRef.current = true;
    setEntryDesktopSaveState(entry.id, "saving");

    try {
      const lineEnding = lineEndingForDesktopFile(
        desktopFilesRef.current[entry.id],
      );
      const result = await shell.saveFileAs({
        suggestedName: suggestedNameForEntry(entry),
        content: markdownForEntry(entry),
        lineEnding,
      });

      if (result.ok) {
        allowSessionSyncForPath(result.path);
        renameEntry(entry.id, basenameForPath(result.path));
        setDesktopFiles((current) => ({
          ...current,
          [entry.id]: {
            path: result.path,
            mtimeMs: result.mtimeMs,
            lineEnding,
          },
        }));
        setEntryDesktopSaveState(entry.id, "saved");
        clearDocumentProblem(entry.id);
        void refreshPersistenceSettings();
        return;
      }

      if (result.code === "cancelled") {
        restoreCancelledSaveState(entry.id, previousState);
        return;
      }

      if (result.code === "conflict") {
        setPendingConflicts((current) => ({
          ...current,
          [entry.id]: {
            ...result,
            entryId: entry.id,
            lineEnding,
            source: "save",
          },
        }));
        setEntryDesktopSaveState(entry.id, "conflict");
        return;
      }

      if (result.code === "permission-needed") {
        setEntryDesktopSaveState(entry.id, "permission-needed");
        setDocumentNotice(entry.id, noticeFromPermission(result));
        return;
      }

      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, noticeFromError(result));
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message:
          "Save As failed before the app received a native result. Choose Save As and try again.",
      });
      console.error("doc2md desktop saveFileAs transport failure", error);
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    allowSessionSyncForPath,
    clearDocumentProblem,
    entrySaveStates,
    restoreCancelledSaveState,
    refreshPersistenceSettings,
    saveState,
    selectedEntry,
    setEntryDesktopSaveState,
    setDocumentNotice,
    shell,
    renameEntry,
  ]);

  const handleSave = useCallback(() => {
    if (!selectedEntry) {
      setDesktopNotice({
        kind: "info",
        message: "Select a document before saving, or start a new draft.",
      });
      return;
    }

    if (
      selectedEntry.status === "pending" ||
      selectedEntry.status === "converting"
    ) {
      setDocumentNotice(selectedEntry.id, {
        kind: "info",
        message: "Finishing conversion. Try saving again in a moment.",
      });
      return;
    }

    if (selectedEntry.status === "error") {
      setDocumentNotice(selectedEntry.id, {
        kind: "error",
        message: CONVERSION_FAILED_SAVE_MESSAGE,
      });
      return;
    }

    const desktopFile = desktopFilesRef.current[selectedEntry.id];
    if (!desktopFile) {
      void handleSaveAs();
      return;
    }

    if (desktopFile.path.toLowerCase().endsWith(".markdown")) {
      void handleSaveAs();
      return;
    }

    void saveEntryFile(selectedEntry);
  }, [handleSaveAs, saveEntryFile, selectedEntry, setDocumentNotice]);

  const hostedHandleSave = useCallback(() => {
    if (!isDownloadableEntry(selectedEntry)) {
      return;
    }

    saveState.markSaving();
    downloadEntry(selectedEntry);
    setEntryDesktopSaveState(selectedEntry.id, "saved");
    saveState.markSaved();
  }, [saveState, selectedEntry, setEntryDesktopSaveState]);

  const effectiveSave = isDesktop ? handleSave : hostedHandleSave;
  const canSaveSelectedEntry = isDesktop
    ? selectedEntry?.status === "success" || selectedEntry?.status === "warning"
    : isDownloadableEntry(selectedEntry);
  const saveButtonBusy = activeSaveState === "saving";
  const saveButtonDisabled = !canSaveSelectedEntry || saveButtonBusy;

  const handleRevealInFinder = useCallback(async () => {
    if (!shell || !selectedPath) {
      if (selectedEntryId) {
        setDocumentNotice(selectedEntryId, {
          kind: "info",
          message: "Save the document before revealing it in Finder.",
        });
      } else {
        setDesktopNotice({
          kind: "info",
          message: "Save the document before revealing it in Finder.",
        });
      }
      return;
    }

    try {
      const result = await shell.revealInFinder({ path: selectedPath });
      if (result.ok) {
        if (selectedEntryId) {
          setDocumentNotice(selectedEntryId, {
            kind: "info",
            message: `Revealed ${basenameForPath(result.path)} in Finder.`,
          });
        }
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (!selectedEntryId) {
        return;
      }

      if (result.code === "permission-needed") {
        setEntryDesktopSaveState(selectedEntryId, "permission-needed");
        setDocumentNotice(selectedEntryId, noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        setEntryDesktopSaveState(selectedEntryId, "error");
        setDocumentNotice(selectedEntryId, noticeFromError(result));
      }
    } catch (error) {
      if (selectedEntryId) {
        setEntryDesktopSaveState(selectedEntryId, "error");
        setDocumentNotice(selectedEntryId, {
          kind: "error",
          message:
            "Reveal in Finder failed before the app received a native result. Save or reload the file, then try again.",
        });
      }
      console.error("doc2md desktop revealInFinder transport failure", error);
    }
  }, [
    selectedEntryId,
    selectedPath,
    setDocumentNotice,
    setEntryDesktopSaveState,
    shell,
  ]);

  const applyReloadedMarkdownFile = useCallback(
    (entry: FileEntry, result: ShellOpenMarkdownOk) => {
      replaceEntryWithMarkdownFile(entry.id, {
        name: basenameForPath(result.path),
        content: result.content,
        lastModified: result.mtimeMs,
      });
      setDesktopFiles((current) => ({
        ...current,
        [entry.id]: {
          path: result.path,
          mtimeMs: result.mtimeMs,
          lineEnding: result.lineEnding,
        },
      }));
      setEntryDesktopSaveState(entry.id, "saved");
      clearDocumentProblem(entry.id);
      clearDesktopProblem();
      void refreshPersistenceSettings();
    },
    [
      clearDesktopProblem,
      clearDocumentProblem,
      refreshPersistenceSettings,
      replaceEntryWithMarkdownFile,
      setEntryDesktopSaveState,
    ],
  );

  // For documents without a disk path (drop-loaded conversions, scratch
  // drafts), reload means "discard my edits and restore the original
  // markdown the document was created with". For disk-backed documents,
  // reload means "re-read the file from disk". The button below
  // dispatches by whether `selectedPath` is set.
  const handleResetEditedMarkdown = useCallback(() => {
    if (!selectedEntry) {
      return;
    }

    if (selectedEntry.editedMarkdown === undefined) {
      setDocumentNotice(selectedEntry.id, {
        kind: "info",
        message: "Nothing to discard — there are no unsaved edits.",
      });
      return;
    }

    if (
      !window.confirm(
        "Discard your edits and restore the original document content?",
      )
    ) {
      return;
    }

    const entryId = selectedEntry.id;
    discardEditedMarkdown(entryId);
    setEntryDesktopSaveState(entryId, "saved");
    clearDocumentProblem(entryId);
  }, [
    clearDocumentProblem,
    discardEditedMarkdown,
    selectedEntry,
    setDocumentNotice,
    setEntryDesktopSaveState,
  ]);

  const handleReloadSelectedDocument = useCallback(async () => {
    if (!selectedEntry) {
      setDesktopNotice({
        kind: "info",
        message: "Select a saved document before reloading it.",
      });
      return;
    }

    const entry = selectedEntry;
    const path = selectedPath;

    if (!shell || !path) {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Open or save the document before reloading it from disk.",
      });
      return;
    }

    if (entry.status === "pending" || entry.status === "converting") {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Finishing conversion. Try reloading again in a moment.",
      });
      return;
    }

    if (activeSaveState === "saving") {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Wait for the current save to finish before reloading.",
      });
      return;
    }

    if (
      activeSaveState !== "saved" &&
      !window.confirm("Reload from disk and discard unsaved changes?")
    ) {
      return;
    }

    try {
      const result = await shell.openFile({ path });
      if (result.ok) {
        if (result.kind !== "markdown") {
          console.error("reload received non-markdown kind");
          setEntryDesktopSaveState(entry.id, "error");
          setDocumentNotice(entry.id, {
            kind: "error",
            message:
              "Reload failed because the file is no longer Markdown. Choose a Markdown file to continue.",
          });
          return;
        }

        applyReloadedMarkdownFile(entry, result);
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        setEntryDesktopSaveState(entry.id, "permission-needed");
        setDocumentNotice(entry.id, noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        setEntryDesktopSaveState(entry.id, "error");
        setDocumentNotice(entry.id, {
          kind: "error",
          message: reloadFailureMessage(result.message),
        });
      }
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message:
          "Reload failed before the app received a native result. Try Reload again or open the file manually.",
      });
      console.error("doc2md desktop reload transport failure", error);
    }
  }, [
    activeSaveState,
    applyReloadedMarkdownFile,
    selectedEntry,
    selectedPath,
    setDocumentNotice,
    setEntryDesktopSaveState,
    shell,
  ]);

  // Reload-from-disk for documents that were loaded without a captured disk
  // path (e.g. drag-dropped). Prompts the user via the native open dialog,
  // then replaces the selected entry's content and registers the path so
  // subsequent reloads do not re-prompt.
  const handleReloadViaPicker = useCallback(async () => {
    if (!shell || !selectedEntry) {
      return;
    }

    const entry = selectedEntry;

    if (entry.status === "pending" || entry.status === "converting") {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Finishing conversion. Try reloading again in a moment.",
      });
      return;
    }

    if (activeSaveState === "saving") {
      setDocumentNotice(entry.id, {
        kind: "info",
        message: "Wait for the current save to finish before reloading.",
      });
      return;
    }

    if (
      activeSaveState !== "saved" &&
      !window.confirm(
        "Reload from disk and discard unsaved changes? Pick the source file in the next dialog.",
      )
    ) {
      return;
    }

    try {
      const result = await shell.openFile();
      if (result.ok) {
        if (result.kind !== "markdown") {
          setEntryDesktopSaveState(entry.id, "error");
          setDocumentNotice(entry.id, {
            kind: "error",
            message:
              "Reload failed because the selected file is not Markdown. Choose the saved Markdown file instead.",
          });
          return;
        }

        applyReloadedMarkdownFile(entry, result);
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        setEntryDesktopSaveState(entry.id, "permission-needed");
        setDocumentNotice(entry.id, noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        setEntryDesktopSaveState(entry.id, "error");
        setDocumentNotice(entry.id, {
          kind: "error",
          message: reloadFailureMessage(result.message),
        });
      }
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message:
          "Reload failed before the app received a native result. Try Reload again or open the file manually.",
      });
      console.error("doc2md desktop reload-via-picker transport failure", error);
    }
  }, [
    activeSaveState,
    applyReloadedMarkdownFile,
    selectedEntry,
    setDocumentNotice,
    setEntryDesktopSaveState,
    shell,
  ]);

  const handleReloadConflict = useCallback(async () => {
    if (!shell || !activePendingConflict) {
      return;
    }

    const entry = entries.find(
      (candidate) => candidate.id === activePendingConflict.entryId,
    );
    if (!entry) {
      setDesktopNotice({
        kind: "error",
        message:
          "The conflicted document is no longer available. Select another document to keep working.",
      });
      setPendingConflicts((current) => {
        return omitRecordKey(current, activePendingConflict.entryId);
      });
      return;
    }

    selectEntry(entry.id);

    try {
      const result = await shell.openFile({ path: activePendingConflict.path });
      if (result.ok) {
        if (result.kind !== "markdown") {
          console.error("conflict-reload received non-markdown kind");
          setPendingConflicts((current) => {
            return omitRecordKey(current, entry.id);
          });
          setEntryDesktopSaveState(entry.id, "error");
          setDocumentNotice(entry.id, {
            kind: "error",
            message:
              "Reload failed because the file is no longer Markdown. Choose a Markdown file to continue.",
          });
          return;
        }

        applyReloadedMarkdownFile(entry, result);
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        setEntryDesktopSaveState(entry.id, "permission-needed");
        setDocumentNotice(entry.id, noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        setEntryDesktopSaveState(entry.id, "error");
        setDocumentNotice(entry.id, noticeFromError(result));
      }
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message:
          "Reload failed before the app received a native result. Try Reload again or open the file manually.",
      });
      console.error("doc2md desktop reload transport failure", error);
    }
  }, [
    activePendingConflict,
    applyReloadedMarkdownFile,
    entries,
    selectEntry,
    setDocumentNotice,
    setEntryDesktopSaveState,
    shell,
  ]);

  const handleOverwriteConflict = useCallback(() => {
    if (!activePendingConflict) {
      return;
    }

    const entry = entries.find(
      (candidate) => candidate.id === activePendingConflict.entryId,
    );
    if (!entry) {
      setDesktopNotice({
        kind: "error",
        message:
          "The conflicted document is no longer available. Select another document to keep working.",
      });
      setPendingConflicts((current) => {
        return omitRecordKey(current, activePendingConflict.entryId);
      });
      return;
    }

    selectEntry(entry.id);
    void saveEntryFile(entry, activePendingConflict.actualMtimeMs);
  }, [activePendingConflict, entries, saveEntryFile, selectEntry]);

  const handleCancelConflict = useCallback(() => {
    if (selectedEntryId) {
      setPendingConflicts((current) => {
        return omitRecordKey(current, selectedEntryId);
      });
      setEntryDesktopSaveState(selectedEntryId, "edited");
    }
  }, [selectedEntryId, setEntryDesktopSaveState]);

  const nativeMenuHandlers = {
    onNew: handleNewDocument,
    onOpen: () => {
      void handleOpenFile();
    },
    onSave: handleSave,
    onSaveAs: () => {
      void handleSaveAs();
    },
    onReload: () => {
      void handleReloadSelectedDocument();
    },
    onRevealInFinder: () => {
      void handleRevealInFinder();
    },
    onCloseWindow: () => {
      if (selectedEntryId) {
        setEntryDesktopSaveState(selectedEntryId, "saved");
        clearDocumentProblem(selectedEntryId);
      } else {
        saveState.reset();
      }
    },
  };
  const workingModeRecentFiles =
    isDesktop && shell && persistenceSettings.persistenceEnabled
      ? persistenceSettings.recentFiles
      : [];
  const renderDesktopSettingsControl = (placement: "hero" | "working") => {
    if (!isDesktop || !shell) {
      return null;
    }

    const popoverId = `desktop-settings-popover-${placement}`;
    const settingsTooltipId = `${popoverId}-tooltip`;
    const recentFiles = persistenceSettings.recentFiles;

    return (
      <div
        ref={settingsPopoverRef}
        className={`desktop-settings desktop-settings--${placement}`}
        onKeyDown={handleDesktopSettingsKeyDown}
      >
        <button
          type="button"
          className="ghost-button desktop-settings-button instant-tooltip-anchor"
          aria-label="Desktop settings"
          aria-expanded={isDesktopSettingsOpen}
          aria-controls={popoverId}
          aria-describedby={isDesktopSettingsOpen ? undefined : settingsTooltipId}
          onClick={() => setIsDesktopSettingsOpen((isOpen) => !isOpen)}
        >
          <Settings className="desktop-settings-icon" aria-hidden="true" />
          {!isDesktopSettingsOpen ? (
            <span
              id={settingsTooltipId}
              role="tooltip"
              className="instant-tooltip instant-tooltip--left"
            >
              Desktop settings
            </span>
          ) : null}
        </button>
        {isDesktopSettingsOpen ? (
          <div
            id={popoverId}
            className="desktop-settings-popover"
            role="dialog"
            aria-label="Desktop settings"
          >
            <label className="desktop-persistence-toggle">
              <input
                type="checkbox"
                checked={persistenceSettings.persistenceEnabled}
                onChange={(event) =>
                  void handlePersistenceEnabledChange(
                    event.currentTarget.checked,
                  )
                }
              />
              <span>Persistence</span>
            </label>

            {persistenceSettings.persistenceEnabled ? (
              <div className="desktop-recent-files">
                <div className="desktop-settings-section-header">
                  <p className="desktop-settings-heading">Recent files</p>
                  {recentFiles.length > 0 && shell.clearRecentFiles ? (
                    <button
                      type="button"
                      className="desktop-clear-recents-button"
                      onClick={() => {
                        void handleClearRecentFiles();
                      }}
                    >
                      Clear history
                    </button>
                  ) : null}
                </div>
                {recentFiles.length > 0 ? (
                  <ol className="desktop-recent-list">
                    {recentFiles.map((file, index) => {
                      const isUnavailable = unavailableRecentPaths.has(file.path);
                      const tooltipId = `${popoverId}-recent-${index}-tooltip`;
                      const tooltipText = isUnavailable
                        ? "Not available. Click to retry opening this file."
                        : `Open ${file.path}`;
                      return (
                        <li key={file.path}>
                          <button
                            type="button"
                            className={`desktop-recent-item instant-tooltip-anchor${
                              isUnavailable ? " is-unavailable" : ""
                            }`}
                            aria-label={`Open ${file.displayName}`}
                            aria-describedby={tooltipId}
                            onClick={() => {
                              // eslint-disable-next-line react-hooks/refs -- click handler opens recent file after user action
                              void handleOpenRecentFile(file.path).then((opened) => {
                                if (opened) {
                                  setIsDesktopSettingsOpen(false);
                                }
                              });
                            }}
                          >
                            <span
                              className="desktop-recent-unavailable-dot"
                              aria-hidden="true"
                            />
                            {isUnavailable ? (
                              <span className="visually-hidden">
                                Not available.{" "}
                              </span>
                            ) : null}
                            <span className="desktop-recent-name">
                              {file.displayName}
                            </span>
                            <span className="desktop-recent-path">
                              {file.path}
                            </span>
                            <time
                              className="desktop-recent-time"
                              dateTime={file.lastOpenedAt}
                            >
                              {file.lastOpenedAt}
                            </time>
                            <span
                              id={tooltipId}
                              role="tooltip"
                              className="instant-tooltip instant-tooltip--menu recent-file-tooltip"
                            >
                              {tooltipText}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="desktop-settings-empty">No recent files yet.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const callbacks: AppShellCallbacks = {
    onNewDocument: handleNewDocument,
    onReturnHome: handleReturnHome,
    onCollapseFromHero: handleCollapseFromHero,
    onLargeMarkdownPaste: handleLargeMarkdownPaste,
    onMarkdownChange: (text) => {
      if (selectedEntry) {
        updateMarkdown(selectedEntry.id, text);
        setEntryDesktopSaveState(selectedEntry.id, "edited");
        setPendingConflicts((current) => {
          return omitRecordKey(current, selectedEntry.id);
        });
      }
    },
  };

  const previewPanelSaveProps: AppShellPreviewPanelSaveProps = {
    saveState: activeSaveState,
    saveBusy: saveButtonBusy,
    saveDisabled: saveButtonDisabled,
    saveKeyShortcuts: isDesktop ? "Meta+S" : undefined,
    lastSavedAt: selectedEntry
      ? (entryLastSavedAt[selectedEntry.id] ?? null)
      : null,
    onSave: effectiveSave,
  };

  const fileListProps: AppShellFileListProps = {
    entries,
    checkedIds: checkedEntryIds,
    saveStatuses: entrySaveStates,
    onCheckedChange: toggleCheckedEntry,
    onClear: handleClear,
    onDownload: handleDownload,
    onSelect: handleSelectEntry,
    onToggleAllChecked: toggleAllChecked,
  };

  const workingModeBarProps: WorkingModeBarProps = {
    variant: "desktop",
    onHome: handleReturnHome,
    onOpen: () => {
      void handleOpenFile();
    },
    onNew: handleNewDocument,
    trailingControls: (
      <>
        <ThemeToggle />
        {isWorkingMode ? renderDesktopSettingsControl("working") : null}
      </>
    ),
    recentFiles: workingModeRecentFiles,
    unavailableRecentPaths,
    onOpenRecentFile: (path) => {
      void handleOpenRecentFile(path);
    },
  };

  const heroActionsSlot = (
    <>
      <ThemeToggle />
      {!isWorkingMode ? renderDesktopSettingsControl("hero") : null}
    </>
  );

  const dropZoneProps: DropZoneProps = {
    onFilesAdded: addFiles,
    onBrowseRequest: shell ? handleOpenFile : undefined,
  };

  const desktopStatusSlot = showDesktopShellBar ? (
    <section
      className={`desktop-shell-bar desktop-shell-bar-${activeSaveState}`}
      aria-label="Desktop file status"
      data-app-ready={appReady ? "true" : undefined}
    >
      <div className="desktop-shell-main">
        <span className="desktop-shell-title-wrap instant-tooltip-anchor">
          <span
            className="desktop-shell-title"
            tabIndex={0}
            aria-describedby="desktop-title-tooltip"
          >
            {selectedEntry ? desktopTitle : "doc2md"}
          </span>
          <span
            id="desktop-title-tooltip"
            role="tooltip"
            className="instant-tooltip instant-tooltip--right"
          >
            {selectedEntry ? desktopTitle : "doc2md"}
          </span>
        </span>
        {selectedEntry ? (
          <>
            <span className="desktop-save-pill">{saveStateLabel}</span>
            {!activePendingConflict ? (
              <button
                type="button"
                className="ghost-button desktop-reload-button instant-tooltip-anchor"
                onClick={() => {
                  if (selectedPath) {
                    void handleReloadSelectedDocument();
                    return;
                  }
                  if (shell) {
                    void handleReloadViaPicker();
                    return;
                  }
                  handleResetEditedMarkdown();
                }}
                disabled={activeSaveState === "saving"}
                aria-label={
                  selectedPath
                    ? "Reload from disk"
                    : shell
                      ? "Reload from disk (pick file)"
                      : "Discard edits and restore original"
                }
                aria-describedby="desktop-reload-tooltip"
              >
                Reload
                <span
                  id="desktop-reload-tooltip"
                  role="tooltip"
                  className="instant-tooltip instant-tooltip--menu"
                >
                  {selectedPath
                    ? "Reload from disk and discard unsaved changes"
                    : shell
                      ? "Pick the source file to reload from disk"
                      : "Discard your edits and restore the original document content"}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-button desktop-reveal-button instant-tooltip-anchor"
              onClick={() => void handleRevealInFinder()}
              disabled={!selectedPath}
              aria-label="Reveal in Finder"
              aria-describedby="desktop-reveal-tooltip"
            >
              Reveal
              <span
                id="desktop-reveal-tooltip"
                role="tooltip"
                className="instant-tooltip instant-tooltip--menu"
              >
                Reveal in Finder
              </span>
            </button>
          </>
        ) : null}
      </div>

      <div
        className="desktop-shell-status"
        role={
          activeSaveState === "conflict" ||
          visibleDesktopNotice.kind === "permission-needed" ||
          visibleDesktopNotice.kind === "error"
            ? "alert"
            : "status"
        }
      >
        {activePendingConflict ? (
          <div className="desktop-conflict-bar">
            <span>File changed on disk.</span>
            <button type="button" onClick={handleReloadConflict}>
              Reload
            </button>
            <button type="button" onClick={handleOverwriteConflict}>
              Overwrite
            </button>
            <button type="button" onClick={handleCancelConflict}>
              Cancel
            </button>
          </div>
        ) : visibleDesktopNotice.kind === "permission-needed" ? (
          <span>Permission needed: {visibleDesktopNotice.message}</span>
        ) : visibleDesktopNotice.kind === "error" ? (
          <span>{visibleDesktopNotice.message}</span>
        ) : visibleDesktopNotice.kind === "info" ? (
          <span>{visibleDesktopNotice.message}</span>
        ) : (
          <span>{selectedPath ?? "No saved path yet."}</span>
        )}
      </div>
    </section>
  ) : null;

  const nativeMenuBridgeSlot = (
    <DesktopMenuBridge isDesktop={isDesktop} handlers={nativeMenuHandlers} />
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
    desktopStatusSlot,
    hiddenInputSlot: null,
    nativeMenuBridgeSlot,
    heroClassExtension: isDesktopSettingsOpen ? "hero--settings-open" : undefined,
  };
}

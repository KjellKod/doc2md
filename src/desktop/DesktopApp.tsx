// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import type { CSSProperties, KeyboardEvent, MouseEvent, SVGProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import AboutSection from "../components/AboutSection";
import DropZone from "../components/DropZone";
import FileList from "../components/FileList";
import InstallPage from "../components/InstallPage";
import PreviewPanel from "../components/PreviewPanel";
import ThemeProvider from "../components/ThemeProvider";
import ThemeToggle from "../components/ThemeToggle";
import WorkingModeBar from "../components/WorkingModeBar";
import { useFileConversion } from "../hooks/useFileConversion";
import { useTheme } from "../hooks/useTheme";
import type { FileEntry } from "../types";
import type {
  DesktopPersistenceSettings,
  ShellFile,
  ShellConflict,
  ShellError,
  ShellLineEnding,
  ShellOpenMarkdownOk,
  ShellPermissionNeeded,
  ShellResult,
} from "../types/doc2mdShell";
import type { Theme } from "../types/theme";
import { entryDisplayName } from "../utils/displayName";
import {
  downloadEntry,
  isDownloadableEntry,
} from "../utils/download";
import type { DesktopSaveState } from "./saveState";
import { useDesktopCapability } from "./useDesktopCapability";
import { useDesktopSaveState } from "./useDesktopSaveState";
import { useNativeMenuEvents } from "./useNativeMenuEvents";

const BASE_PAGE_MAX_WIDTH = 1680;
const DEFAULT_SIDEBAR_WIDTH = 430;
const SIDEBAR_COLLAPSE_WIDTH = 56;
const SIDEBAR_SNAP_THRESHOLD = 200;
const SIDEBAR_WIDTH_STEP = 16;
const MIN_EDIT_SHELL_HEIGHT = 240;
const EDIT_SHELL_HEIGHT_STEP = 32;
const EDIT_SHELL_BOTTOM_GUTTER = 36;
const DEFAULT_HEADER_OFFSET_PX = 280;
const MAX_SIDEBAR_WIDTH = DEFAULT_SIDEBAR_WIDTH;
type PageView = "convert" | "install";
type ResizeAxis = "sidebar" | "height";
const DISPLAY_VERSION = __DOC2MD_DISPLAY_VERSION__;
const CONVERSION_FAILED_SAVE_MESSAGE =
  "Cannot save: conversion failed. Please re-open the file or choose another.";
const PERSISTENCE_UNAVAILABLE_MESSAGE =
  "Desktop persistence settings unavailable.";
const DEFAULT_DESKTOP_PERSISTENCE_SETTINGS: DesktopPersistenceSettings = {
  ok: true,
  persistenceEnabled: false,
  recentFiles: [],
};

function PanelRightOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m14 8 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelRightCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 5H9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10 8-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

const PAGES: PageView[] = ["convert", "install"];

function markdownForEntry(entry: FileEntry | null) {
  return entry?.editedMarkdown ?? entry?.markdown ?? "";
}

function suggestedNameForEntry(entry: FileEntry | null) {
  return entry?.name || "Untitled.md";
}

function basenameForPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path || "Untitled.md";
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

const IMPORT_HANDOFF_EXPIRED_MESSAGE = "Import handoff expired. Open the file again.";
const IMPORT_HANDOFF_FAILED_MESSAGE =
  "Import failed before the app received the file bytes.";

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
  result: ShellResult<DesktopPersistenceSettings>,
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

function computeEditShellCeiling(
  innerHeight: number,
  previewPanelTop: number | null,
  bottomGutter = EDIT_SHELL_BOTTOM_GUTTER,
  fallbackHeaderOffset = DEFAULT_HEADER_OFFSET_PX,
): number {
  const raw =
    typeof previewPanelTop === "number" &&
    Number.isFinite(previewPanelTop) &&
    previewPanelTop > 0
      ? innerHeight - previewPanelTop - bottomGutter
      : innerHeight - fallbackHeaderOffset;

  return Math.max(MIN_EDIT_SHELL_HEIGHT, Math.round(raw));
}

function outerHeight(element: Element | null): number {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;

  return rect.height + marginTop + marginBottom;
}

function computeFallbackHeaderOffsetPx(): number {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return DEFAULT_HEADER_OFFSET_PX;
  }

  const workspace = document.querySelector(".workspace");
  const workspaceTop = workspace?.getBoundingClientRect().top;
  if (
    typeof workspaceTop === "number" &&
    Number.isFinite(workspaceTop) &&
    workspaceTop > 0
  ) {
    return Math.round(workspaceTop);
  }

  const appShell = document.querySelector(".app-shell");
  const hero = document.querySelector(".hero");
  const viewSwitcherRow = document.querySelector(".view-switcher-row");
  const appShellTopPadding =
    appShell instanceof HTMLElement
      ? Number.parseFloat(window.getComputedStyle(appShell).paddingTop) || 0
      : 0;
  // Fallback breakdown: app shell top padding, rendered hero height,
  // rendered view-switcher row including its bottom margin, and a small
  // workspace gap allowance when layout has not produced a usable rect yet.
  const measuredOffset =
    appShellTopPadding + outerHeight(hero) + outerHeight(viewSwitcherRow) + 24;

  return measuredOffset > 0
    ? Math.round(measuredOffset)
    : DEFAULT_HEADER_OFFSET_PX;
}

function clampEditShellHeight(height: number, ceiling: number) {
  return Math.min(
    Math.max(Math.round(height), MIN_EDIT_SHELL_HEIGHT),
    Math.max(MIN_EDIT_SHELL_HEIGHT, ceiling),
  );
}

function clampSidebarWidth(width: number) {
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_COLLAPSE_WIDTH),
    MAX_SIDEBAR_WIDTH,
  );
}

function clampKeyboardSidebarWidth(width: number) {
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_SNAP_THRESHOLD),
    MAX_SIDEBAR_WIDTH,
  );
}

function AppContent() {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [showLandingChrome, setShowLandingChrome] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeResizeAxis, setActiveResizeAxis] =
    useState<ResizeAxis | null>(null);
  const [editShellHeight, setEditShellHeight] = useState<number | null>(null);
  const [editShellHeightCeiling, setEditShellHeightCeiling] = useState(() =>
    computeEditShellCeiling(
      typeof window === "undefined" ? DEFAULT_HEADER_OFFSET_PX : window.innerHeight,
      null,
    ),
  );
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const editShellHeightCeilingRef = useRef(editShellHeightCeiling);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef<number | null>(null);
  const dragStartSidebarWidthRef = useRef<number | null>(null);
  const latestSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const restoreSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const lastSidebarClickAtRef = useRef(-Infinity);
  const lastHeightClickAtRef = useRef(-Infinity);
  const sidebarDragMovedRef = useRef(false);
  const heightDragMovedRef = useRef(false);
  // Mirror of the hosted App's working-mode auto-collapse: fires once per
  // session when the user opens a non-scratch entry AND has not touched
  // the sidebar yet. Without this, the Mac shell stayed in landing-mode
  // chrome on first file open (regression caught in manual validation).
  const userTouchedSidebarRef = useRef(false);
  const firstAutoCollapseFiredRef = useRef(false);
  const previousSelectedEntryIdRef = useRef<string | null>(null);
  const {
    entries,
    addFiles,
    addUrl,
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
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false);
  const [persistenceSettings, setPersistenceSettings] =
    useState<DesktopPersistenceSettings>(DEFAULT_DESKTOP_PERSISTENCE_SETTINGS);
  const [initialPersistenceLoaded, setInitialPersistenceLoaded] =
    useState(false);
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    id: number;
    target: "editor";
  }>({ id: 0, target: "editor" });
  const selectedEntryId = selectedEntry?.id ?? null;
  const hasWorkingEntry = selectedEntry !== null && !selectedEntry.isScratch;
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
    "Start from scratch or with single and mixed-format batches",
    " open",
  );
  const fileSummary = buildSummary("No files or drafts yet.", "");

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
  // applied here so the Mac shell actually collapses the upload chrome
  // when the user opens a file.
  useEffect(() => {
    const previous = previousSelectedEntryIdRef.current;
    previousSelectedEntryIdRef.current = selectedEntryId;

    if (firstAutoCollapseFiredRef.current) return;
    if (previous !== null || selectedEntryId === null) return;
    if (selectedEntry?.isScratch) return;
    if (userTouchedSidebarRef.current) return;
    if (sidebarCollapsed) return;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      if (window.matchMedia("(max-width: 980px)").matches) return;
    }

    firstAutoCollapseFiredRef.current = true;
    restoreSidebarWidthRef.current =
      sidebarWidth ?? measureSidebarWidth() ?? DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(true);
  }, [selectedEntry?.isScratch, selectedEntryId, sidebarCollapsed, sidebarWidth]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia("(max-width: 980px)");
    const handleChange = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setSidebarCollapsed(false);
        setActiveResizeAxis(null);
        // Clear drag-driven inline overrides when the layout
        // collapses to the mobile single-column breakpoint. Without
        // this, a previously dragged-large editor height or
        // narrowed sidebar would persist as inline style and
        // override the @media single-column rules below 980px,
        // leaving narrow viewports stuck in a desktop layout.
        setEditShellHeight(null);
        setSidebarWidth(null);
      }
    };

    handleChange(mediaQueryList);

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);

      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    mediaQueryList.addListener(handleChange);

    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, []);

  const recomputeEditShellHeightCeiling = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previewPanelTop =
      previewPanelRef.current?.getBoundingClientRect().top ?? null;
    const ceiling = computeEditShellCeiling(
      window.innerHeight,
      previewPanelTop,
      EDIT_SHELL_BOTTOM_GUTTER,
      computeFallbackHeaderOffsetPx(),
    );
    editShellHeightCeilingRef.current = ceiling;
    setEditShellHeightCeiling((current) =>
      current === ceiling ? current : ceiling,
    );
    setEditShellHeight((current) =>
      current === null ? current : clampEditShellHeight(current, ceiling),
    );
  }, []);

  useEffect(() => {
    recomputeEditShellHeightCeiling();

    let frameId: number | null = null;
    if (typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(recomputeEditShellHeightCeiling);
    }

    window.addEventListener("resize", recomputeEditShellHeightCeiling);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(recomputeEditShellHeightCeiling);
      const previewPanel = previewPanelRef.current;
      const observedElements = new Set<Element>();

      if (previewPanel) {
        observedElements.add(previewPanel);
        if (previewPanel.parentElement) {
          observedElements.add(previewPanel.parentElement);
        }
        const viewPanel = previewPanel.closest(".view-panel");
        if (viewPanel) {
          observedElements.add(viewPanel);
        }
      }

      const appShell = document.querySelector(".app-shell");
      if (appShell) {
        observedElements.add(appShell);
      }

      observedElements.forEach((element) => observer?.observe(element));
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", recomputeEditShellHeightCeiling);
      observer?.disconnect();
    };
  }, [recomputeEditShellHeightCeiling]);

  useEffect(() => {
    if (activeResizeAxis === null) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (activeResizeAxis === "sidebar") {
        const baseSidebarWidth = dragStartSidebarWidthRef.current;
        if (baseSidebarWidth === null) {
          return;
        }
        if (Math.abs(event.clientX - dragStartXRef.current) > 2) {
          sidebarDragMovedRef.current = true;
        }
        const nextWidth = clampSidebarWidth(
          baseSidebarWidth + (event.clientX - dragStartXRef.current),
        );
        latestSidebarWidthRef.current = nextWidth;
        setSidebarWidth(nextWidth);
        return;
      }

      const baseHeight = dragStartHeightRef.current;
      if (baseHeight !== null) {
        if (Math.abs(event.clientY - dragStartYRef.current) > 2) {
          heightDragMovedRef.current = true;
        }
        setEditShellHeight(
          clampEditShellHeight(
            baseHeight + (event.clientY - dragStartYRef.current),
            editShellHeightCeilingRef.current,
          ),
        );
      }
    };
    const handleMouseUp = (event: globalThis.MouseEvent) => {
      if (
        activeResizeAxis === "sidebar" &&
        latestSidebarWidthRef.current < SIDEBAR_SNAP_THRESHOLD
      ) {
        const restoreWidth = restoreSidebarWidthRef.current;
        setSidebarWidth(restoreWidth);
        // Snap-collapse remains in-session only; reload behavior is unchanged, with no localStorage or desktop-settings write.
        setSidebarCollapsed(true);
      }
      if (activeResizeAxis === "sidebar") {
        if (sidebarDragMovedRef.current) {
          userTouchedSidebarRef.current = true;
        }
        lastSidebarClickAtRef.current = sidebarDragMovedRef.current
          ? -Infinity
          : event.timeStamp;
      }
      if (activeResizeAxis === "height") {
        lastHeightClickAtRef.current = heightDragMovedRef.current
          ? -Infinity
          : event.timeStamp;
      }
      setActiveResizeAxis(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeResizeAxis]);

  useEffect(() => {
    document.body.classList.toggle(
      "is-sidebar-resizing",
      activeResizeAxis === "sidebar",
    );
    document.body.classList.toggle(
      "is-height-resizing",
      activeResizeAxis === "height",
    );

    return () => {
      document.body.classList.remove("is-sidebar-resizing");
      document.body.classList.remove("is-height-resizing");
    };
  }, [activeResizeAxis]);

  useEffect(() => {
    currentThemeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const liveEntryIds = new Set(entries.map((entry) => entry.id));
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

  useEffect(() => {
    if (!shell) {
      setPersistenceSettings(DEFAULT_DESKTOP_PERSISTENCE_SETTINGS);
      setInitialPersistenceLoaded(false);
      setIsDesktopSettingsOpen(false);
      resetPersistenceLifecycleRefs(currentThemeRef.current);
      return;
    }

    let cancelled = false;
    const desktopShell = shell;
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

  // Measure the panel that the handle controls (the preview panel
  // contains both the heading and the active surface, so its rendered
  // height is the "current size" the drag starts from). Fall back to
  // the edit shell when in edit mode, and finally to MIN if neither
  // exists yet.
  function measureEditShellHeight(): number | null {
    if (typeof document === "undefined") {
      return null;
    }
    const panel = document.querySelector(".preview-panel");
    if (panel) {
      return clampEditShellHeight(
        panel.getBoundingClientRect().height,
        editShellHeightCeilingRef.current,
      );
    }
    const shell = document.querySelector(".markdown-edit-shell");
    if (shell) {
      return clampEditShellHeight(
        shell.getBoundingClientRect().height,
        editShellHeightCeilingRef.current,
      );
    }
    return MIN_EDIT_SHELL_HEIGHT;
  }

  function measureSidebarWidth(): number | null {
    if (typeof document === "undefined") {
      return null;
    }
    const sidebar =
      document.querySelector<HTMLElement>(".sidebar-panel") ??
      document.querySelector<HTMLElement>(".collapse-rail");
    if (!sidebar) {
      return null;
    }
    return clampSidebarWidth(sidebar.getBoundingClientRect().width);
  }

  const handleSidebarResizeStart = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail >= 2) {
      event.preventDefault();
      handleSidebarResizeReset();
      return;
    }

    const measuredSidebarWidth = measureSidebarWidth();
    const startWidth =
      sidebarWidth ?? measuredSidebarWidth ?? MAX_SIDEBAR_WIDTH;
    dragStartXRef.current = event.clientX;
    dragStartSidebarWidthRef.current = startWidth;
    latestSidebarWidthRef.current = startWidth;
    restoreSidebarWidthRef.current = startWidth;
    sidebarDragMovedRef.current = false;
    setSidebarWidth(startWidth);
    setSidebarCollapsed(false);
    setActiveResizeAxis("sidebar");
  };

  const handleSidebarResizeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      userTouchedSidebarRef.current = true;
      setSidebarWidth((current) =>
        clampKeyboardSidebarWidth(
          (current ?? measureSidebarWidth() ?? MAX_SIDEBAR_WIDTH) +
            SIDEBAR_WIDTH_STEP,
        ),
      );
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      userTouchedSidebarRef.current = true;
      setSidebarWidth((current) =>
        clampKeyboardSidebarWidth(
          (current ?? measureSidebarWidth() ?? MAX_SIDEBAR_WIDTH) -
            SIDEBAR_WIDTH_STEP,
        ),
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      handleSidebarResizeReset();
    }
  };

  const handleSidebarResizeClickReset = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const elapsedSinceLastClick = event.timeStamp - lastSidebarClickAtRef.current;
    lastSidebarClickAtRef.current = event.timeStamp;

    if (event.detail < 2 && elapsedSinceLastClick >= 500) {
      return;
    }

    event.preventDefault();
    lastSidebarClickAtRef.current = -Infinity;
    handleSidebarResizeReset();
  };

  const handleSidebarResizeMouseUp = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    lastSidebarClickAtRef.current = sidebarDragMovedRef.current
      ? -Infinity
      : event.timeStamp;
  };

  const handleSidebarResizeReset = () => {
    userTouchedSidebarRef.current = true;
    lastSidebarClickAtRef.current = -Infinity;
    restoreSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    latestSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(false);
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  };

  const handleCollapseSidebar = () => {
    userTouchedSidebarRef.current = true;
    restoreSidebarWidthRef.current =
      sidebarWidth ?? measureSidebarWidth() ?? DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(true);
  };

  const handleShowSidebar = () => {
    userTouchedSidebarRef.current = true;
    setSidebarWidth(restoreSidebarWidthRef.current);
    setSidebarCollapsed(false);
  };

  const handleHeightResizeStart = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail >= 2) {
      event.preventDefault();
      handleHeightResizeReset();
      return;
    }

    recomputeEditShellHeightCeiling();
    const measuredHeight =
      editShellHeight ?? measureEditShellHeight() ?? MIN_EDIT_SHELL_HEIGHT;
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = measuredHeight;
    heightDragMovedRef.current = false;
    setActiveResizeAxis("height");
  };

  const handleHeightResizeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setEditShellHeight((current) =>
        clampEditShellHeight(
          (current ?? measureEditShellHeight() ?? MIN_EDIT_SHELL_HEIGHT) +
            EDIT_SHELL_HEIGHT_STEP,
          editShellHeightCeilingRef.current,
        ),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setEditShellHeight((current) =>
        clampEditShellHeight(
          (current ?? measureEditShellHeight() ?? MIN_EDIT_SHELL_HEIGHT) -
            EDIT_SHELL_HEIGHT_STEP,
          editShellHeightCeilingRef.current,
        ),
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      handleHeightResizeReset();
    }
  };

  const handleHeightResizeClickReset = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const elapsedSinceLastClick = event.timeStamp - lastHeightClickAtRef.current;
    lastHeightClickAtRef.current = event.timeStamp;

    if (event.detail < 2 && elapsedSinceLastClick >= 500) {
      return;
    }

    event.preventDefault();
    lastHeightClickAtRef.current = -Infinity;
    handleHeightResizeReset();
  };

  const handleHeightResizeMouseUp = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    lastHeightClickAtRef.current = heightDragMovedRef.current
      ? -Infinity
      : event.timeStamp;
  };

  const handleHeightResizeReset = () => {
    lastHeightClickAtRef.current = -Infinity;
    setEditShellHeight(null);
  };

  const pageFrameStyle = {
    "--page-max-width": `${BASE_PAGE_MAX_WIDTH}px`,
  } as CSSProperties;

  const workspaceStyle = {
    "--sidebar-width": `${sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH}px`,
  } as CSSProperties & Record<"--sidebar-width", string>;

  const previewPanelStyle =
    editShellHeight !== null
      ? ({
          "--preview-panel-ceiling": `${editShellHeightCeiling}px`,
          height: `${editShellHeight}px`,
          minHeight: `${editShellHeight}px`,
        } as CSSProperties & Record<"--preview-panel-ceiling", string>)
      : ({
          "--preview-panel-ceiling": `${editShellHeightCeiling}px`,
        } as CSSProperties & Record<"--preview-panel-ceiling", string>);

  const focusPageTab = (page: PageView) => {
    const tab =
      page === "convert" ? convertTabRef.current : installTabRef.current;
    tab?.focus();
  };

  const handleViewTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentPage: PageView,
  ) => {
    const pages = PAGES;
    const currentIndex = pages.indexOf(currentPage);
    let nextPage: PageView | null = null;

    if (event.key === "ArrowRight") {
      nextPage = pages[(currentIndex + 1) % pages.length];
    } else if (event.key === "ArrowLeft") {
      nextPage = pages[(currentIndex - 1 + pages.length) % pages.length];
    } else if (event.key === "Home") {
      nextPage = pages[0];
    } else if (event.key === "End") {
      nextPage = pages[pages.length - 1];
    }

    if (!nextPage) {
      return;
    }

    event.preventDefault();
    setActivePage(nextPage);
    focusPageTab(nextPage);
  };

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
          message: "Stat failed before the app received a native result.",
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
    setShowLandingChrome(true);
    setActivePage("convert");
  }, []);

  const handleCollapseFromHero = useCallback(() => {
    if (!hasWorkingEntry) {
      return;
    }
    setShowLandingChrome(false);
  }, [hasWorkingEntry]);

  const handleOpenFileResult = useCallback(
    async (result: ShellResult<ShellFile>) => {
      if (result.ok) {
        if (result.kind === "markdown") {
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
          void refreshPersistenceSettings();
          return;
        }

        void refreshPersistenceSettings();

        if (window.location.protocol !== "doc2md:") {
          setDesktopNotice({
            kind: "info",
            message:
              "Importing non-Markdown files requires the Release desktop bundle. Run `npm run build:mac` or open the file from the installed app.",
          });
          return;
        }

        const importResponse = await fetch(result.importUrl);
        if (!importResponse.ok) {
          const message = await readImportFailureMessage(importResponse);
          saveState.markError();
          setDesktopNotice({
            kind: "error",
            message,
          });
          return;
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
        return;
      }

      if (result.code === "cancelled") {
        return;
      }

      if (result.code === "permission-needed") {
        setDesktopNotice(noticeFromPermission(result));
        return;
      }

      if (result.code === "error") {
        setDesktopNotice(noticeFromError(result));
      }
    },
    [
      addImportedFileEntry,
      addMarkdownEntry,
      clearDesktopProblem,
      clearDocumentProblem,
      refreshPersistenceSettings,
      saveState,
    ],
  );

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
        message: "Open failed before the app received a native result.",
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
        return;
      }

      try {
        const result = await shell.openFile({ path });
        await handleOpenFileResult(result);
      } catch (error) {
        saveState.markError();
        setDesktopNotice({
          kind: "error",
          message: "Open failed before the app received a native result.",
        });
        console.error("doc2md desktop openFile transport failure", error);
      }
    },
    [handleOpenFileResult, saveState, shell],
  );

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
          message: "Save failed before the app received a native result.",
        });
        console.error("doc2md desktop saveFile transport failure", error);
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [
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
        message: "Save As failed before the app received a native result.",
      });
      console.error("doc2md desktop saveFileAs transport failure", error);
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
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
        message: "Select a document before saving.",
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
          message: "Reveal failed before the app received a native result.",
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
            message: "Reload failed: file is no longer a Markdown target.",
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
          message: `Unable to reload file from disk: ${result.message}`,
        });
      }
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message: "Reload failed before the app received a native result.",
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
            message: "Reload failed: selected file is not a Markdown target.",
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
          message: `Unable to reload file from disk: ${result.message}`,
        });
      }
    } catch (error) {
      setEntryDesktopSaveState(entry.id, "error");
      setDocumentNotice(entry.id, {
        kind: "error",
        message: "Reload failed before the app received a native result.",
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
        message: "The conflicted document is no longer available.",
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
            message: "Reload failed: file is no longer a Markdown target.",
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
        message: "Reload failed before the app received a native result.",
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
        message: "The conflicted document is no longer available.",
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
  const workingModeBarInertProps = !isWorkingMode
    ? ({ inert: "" } as Record<string, string>)
    : {};
  const landingChromeInertProps = isWorkingMode
    ? ({ inert: "" } as Record<string, string>)
    : {};

  return (
      <div className="app-shell">
        <DesktopMenuBridge
          isDesktop={isDesktop}
          handlers={nativeMenuHandlers}
        />
        <main
          className={`page-frame${activeResizeAxis !== null ? " is-resizing" : ""}`}
          style={pageFrameStyle}
        >
          <div className={`page${isWorkingMode ? " is-working-mode" : ""}`}>
            <p className="page-version" aria-label="Current release version">
              {DISPLAY_VERSION}
            </p>
            <div
              aria-hidden={!isWorkingMode}
              {...workingModeBarInertProps}
            >
              <WorkingModeBar
                variant="desktop"
                onHome={handleReturnHome}
                onOpen={() => {
                  void handleOpenFile();
                }}
                onNew={handleNewDocument}
                recentFiles={workingModeRecentFiles}
                onOpenRecentFile={(path) => {
                  void handleOpenRecentFile(path);
                }}
              />
            </div>
            <header
              className="hero"
              aria-hidden={isWorkingMode}
              {...landingChromeInertProps}
            >
              <div className="hero-top">
                <button
                  type="button"
                  className="eyebrow eyebrow-toggle"
                  aria-label={
                    hasWorkingEntry
                      ? "Hide intro and return to editor"
                      : "doc2md, private markdown workspace"
                  }
                  aria-disabled={!hasWorkingEntry}
                  onClick={handleCollapseFromHero}
                  title={
                    hasWorkingEntry
                      ? "Hide intro and return to editor"
                      : undefined
                  }
                >
                  <span className="eyebrow-brand">doc2md</span>
                  <span className="eyebrow-sep" aria-hidden="true"> - </span>
                  <span className="eyebrow-tagline">PRIVATE MARKDOWN WORKSPACE</span>
                </button>
                <div className="hero-actions">
                  <ThemeToggle />
                  {isDesktop && shell ? (
                    <div
                      ref={settingsPopoverRef}
                      className="desktop-settings"
                      onKeyDown={handleDesktopSettingsKeyDown}
                    >
                      <button
                        type="button"
                        className="ghost-button desktop-settings-button"
                        aria-label="Desktop settings"
                        aria-expanded={isDesktopSettingsOpen}
                        aria-controls="desktop-settings-popover"
                        onClick={() =>
                          setIsDesktopSettingsOpen((isOpen) => !isOpen)
                        }
                        title="Desktop settings"
                      >
                        <Settings className="desktop-settings-icon" aria-hidden="true" />
                      </button>
                      {isDesktopSettingsOpen ? (
                        <div
                          id="desktop-settings-popover"
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
                              <p className="desktop-settings-heading">
                                Recent files
                              </p>
                              {persistenceSettings.recentFiles.length > 0 ? (
                                <ol className="desktop-recent-list">
                                  {persistenceSettings.recentFiles.map((file) => (
                                    <li
                                      key={file.path}
                                      className="desktop-recent-item"
                                    >
                                      <span className="desktop-recent-name">
                                        {file.displayName}
                                      </span>
                                      <span
                                        className="desktop-recent-path"
                                        title={file.path}
                                      >
                                        {file.path}
                                      </span>
                                      <time
                                        className="desktop-recent-time"
                                        dateTime={file.lastOpenedAt}
                                      >
                                        {file.lastOpenedAt}
                                      </time>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="desktop-settings-empty">
                                  No recent files yet.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <h1>
                {"Edit or convert to Markdown, "}
                <br />
                {"without leaving the browser."}
              </h1>
              <p className="hero-copy">
                Browser only, privacy first. Start with a blank draft, edit
                existing content, or convert{" "}
                <strong>.md</strong>, <strong>.txt</strong>,{" "}
                <strong>.json</strong>, <strong>.csv</strong>,{" "}
                <strong>.tsv</strong>, <strong>.html</strong>,{" "}
                <strong>.docx</strong>, <strong>.xlsx</strong>,{" "}
                <strong>.pdf</strong>, and <strong>.pptx</strong> files to
                Markdown.
              </p>
            </header>

            <div
              className="view-switcher-row"
              aria-hidden={isWorkingMode}
              {...landingChromeInertProps}
            >
              <div
                className="view-switcher"
                role="tablist"
                aria-label="doc2md views"
              >
                <button
                  id="view-tab-convert"
                  ref={convertTabRef}
                  type="button"
                  role="tab"
                  aria-selected={activePage === "convert"}
                  aria-controls="view-panel-convert"
                  tabIndex={activePage === "convert" ? 0 : -1}
                  className={`view-tab${activePage === "convert" ? " is-active" : ""}`}
                  onClick={() => setActivePage("convert")}
                  onKeyDown={(event) => handleViewTabKeyDown(event, "convert")}
                >
                  Convert
                </button>
                <button
                  id="view-tab-install"
                  ref={installTabRef}
                  type="button"
                  role="tab"
                  aria-selected={activePage === "install"}
                  aria-controls="view-panel-install"
                  tabIndex={activePage === "install" ? 0 : -1}
                  className={`view-tab${activePage === "install" ? " is-active" : ""}`}
                  onClick={() => setActivePage("install")}
                  onKeyDown={(event) => handleViewTabKeyDown(event, "install")}
                >
                  Install & Use
                </button>
              </div>
              <span className="view-switcher-meta" aria-live="polite">
                {activePage === "convert"
                  ? heroSummary
                  : "CLI, Node, and portable skill setup from one place"}
              </span>
            </div>

            <section
              id="view-panel-convert"
              className="view-panel"
              role="tabpanel"
              aria-labelledby="view-tab-convert"
              hidden={activePage !== "convert"}
            >
              {showDesktopShellBar ? (
                <section
                  className={`desktop-shell-bar desktop-shell-bar-${activeSaveState}`}
                  aria-label="Desktop file status"
                  data-app-ready={appReady ? "true" : undefined}
                >
                  <div className="desktop-shell-main">
                    <span
                      className="desktop-shell-title"
                      title={selectedEntry ? desktopTitle : "doc2md"}
                    >
                      {selectedEntry ? desktopTitle : "doc2md"}
                    </span>
                    {selectedEntry ? (
                      <>
                        <span className="desktop-save-pill">
                          {saveStateLabel}
                        </span>
                        {!activePendingConflict ? (
                          <button
                            type="button"
                            className="ghost-button desktop-reload-button"
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
                            title={
                              selectedPath
                                ? "Reload from disk and discard unsaved changes"
                                : shell
                                  ? "Pick the source file to reload from disk"
                                  : "Discard your edits and restore the original document content"
                            }
                          >
                            Reload
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="ghost-button desktop-reveal-button"
                          onClick={() => void handleRevealInFinder()}
                          disabled={!selectedPath}
                          aria-label="Reveal in Finder"
                          title="Reveal in Finder"
                        >
                          Reveal
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
                      <span>
                        Permission needed: {visibleDesktopNotice.message}
                      </span>
                    ) : visibleDesktopNotice.kind === "error" ? (
                      <span>{visibleDesktopNotice.message}</span>
                    ) : visibleDesktopNotice.kind === "info" ? (
                      <span>{visibleDesktopNotice.message}</span>
                    ) : (
                      <span>{selectedPath ?? "No saved path yet."}</span>
                    )}
                  </div>
                </section>
              ) : null}

              <section
                className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeResizeAxis !== null ? " is-resizing" : ""}`}
                style={sidebarCollapsed ? undefined : workspaceStyle}
              >
                <span id="split-bar-resize-hint" className="visually-hidden">
                  Drag left or right to resize the upload panel. Double-click or
                  press Home to reset. Use Arrow Left and Arrow Right for
                  keyboard resizing.
                </span>
                <span id="preview-height-resize-hint" className="visually-hidden">
                  Drag up or down to resize the editor height. Double-click or
                  press Home to reset. Use Arrow Up and Arrow Down for keyboard
                  resizing.
                </span>
                {sidebarCollapsed ? (
                  <section className="panel collapse-rail" aria-label="Upload rail">
                    <button
                      type="button"
                      className="collapse-rail-button"
                      onClick={handleShowSidebar}
                      aria-label="Show upload panel"
                      title="Show upload panel"
                    >
                      <PanelRightOpenIcon
                        className="collapse-toggle-icon"
                        aria-hidden="true"
                      />
                      <span className="collapse-rail-label">Upload</span>
                    </button>
                  </section>
                ) : (
                  <section
                    className="panel sidebar-panel"
                    aria-labelledby="upload-title"
                  >
                    <div className="panel-heading">
                      <div>
                        <h2 id="upload-title">Upload</h2>
                        <p className="panel-copy">
                          Drop in documents, spreadsheets, PDFs, or
                          presentations, add a doc URL, or start writing from
                          scratch and keep everything in one session.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button collapse-toggle"
                        onClick={handleCollapseSidebar}
                        aria-label="Hide upload panel"
                        title="Hide upload panel"
                      >
                        <PanelRightCloseIcon
                          className="collapse-toggle-icon"
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <DropZone
                      onFilesAdded={addFiles}
                      onUrlAdded={handleUrlAdded}
                      onBrowseRequest={shell ? handleOpenFile : undefined}
                    />

                    <div className="panel-heading panel-heading-tight">
                      <div>
                        <h2>Files</h2>
                        <p className="panel-copy">{fileSummary}</p>
                      </div>
                    </div>

                    <FileList
                      entries={entries}
                      checkedIds={checkedEntryIds}
                      saveStatuses={entrySaveStates}
                      onCheckedChange={toggleCheckedEntry}
                      onClear={handleClear}
                      onDownload={handleDownload}
                      onSelect={handleSelectEntry}
                      onToggleAllChecked={toggleAllChecked}
                    />
                  </section>
                )}

                <section
                  ref={previewPanelRef}
                  className="panel preview-panel"
                  aria-labelledby="preview-title"
                  style={previewPanelStyle}
                >
                  {!sidebarCollapsed ? (
                    <button
                      type="button"
                      className="workspace-split-bar"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize upload panel"
                      aria-describedby="split-bar-resize-hint"
                      title="Drag to resize the upload panel; double-click to reset"
                      onMouseDown={handleSidebarResizeStart}
                      onMouseUp={handleSidebarResizeMouseUp}
                      onClick={handleSidebarResizeClickReset}
                      onDoubleClick={handleSidebarResizeReset}
                      onKeyDown={handleSidebarResizeKeyDown}
                    />
                  ) : null}
                  <div className="panel-heading">
                    <div>
                      <h2 id="preview-title">Preview</h2>
                      <p className="panel-copy">
                        {selectedEntry
                          ? entryDisplayName(selectedEntry)
                          : "Start writing, paste Markdown, or convert a file and review it here."}
                      </p>
                    </div>
                  </div>
                  <PreviewPanel
                    entry={selectedEntry}
                    onStartWriting={handleNewDocument}
                    onNewDocument={handleNewDocument}
                    editorFocusRequest={editorFocusRequest}
                    onSave={effectiveSave}
                    saveBusy={saveButtonBusy}
                    saveDisabled={saveButtonDisabled}
                    saveKeyShortcuts={isDesktop ? "Meta+S" : undefined}
                    saveState={activeSaveState}
                    lastSavedAt={
                      selectedEntry
                        ? (entryLastSavedAt[selectedEntry.id] ?? null)
                        : null
                    }
                    onMarkdownChange={(text) => {
                      if (selectedEntry) {
                        updateMarkdown(selectedEntry.id, text);
                        setEntryDesktopSaveState(selectedEntry.id, "edited");
                        setPendingConflicts((current) => {
                          return omitRecordKey(current, selectedEntry.id);
                        });
                      }
                    }}
                  />
                  {selectedEntry ? (
                    <button
                      type="button"
                      className="preview-height-handle"
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize editor height"
                      aria-describedby="preview-height-resize-hint"
                      title="Drag to resize the editor height; double-click to reset"
                      onMouseDown={handleHeightResizeStart}
                      onMouseUp={handleHeightResizeMouseUp}
                      onClick={handleHeightResizeClickReset}
                      onDoubleClick={handleHeightResizeReset}
                      onKeyDown={handleHeightResizeKeyDown}
                    />
                  ) : null}
                </section>
              </section>

              <AboutSection />
            </section>

            <section
              id="view-panel-install"
              className="view-panel"
              role="tabpanel"
              aria-labelledby="view-tab-install"
              hidden={activePage !== "install"}
            >
              <InstallPage active={activePage === "install"} />
            </section>
          </div>
        </main>
      </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

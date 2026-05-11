import type { CSSProperties, KeyboardEvent, MouseEvent, SVGProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AboutSection from "./components/AboutSection";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import InstallPage from "./components/InstallPage";
import PreviewPanel from "./components/PreviewPanel";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import { useFileConversion } from "./hooks/useFileConversion";
import { useSaveState } from "./hooks/useSaveState";
import type { FileEntry } from "./types";
import type { SaveState } from "./types/saveState";
import { entryDisplayName } from "./utils/displayName";
import { downloadEntry, isDownloadableEntry } from "./utils/download";

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

// eslint-disable-next-line react-refresh/only-export-components -- Approved Quest plan imports this helper from App tests.
export function computeEditShellCeiling(
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
  const activeEntryIdRef = useRef<string | null>(null);
  const saveStateRef = useRef<SaveState>(saveState.state);
  const entriesRef = useRef<FileEntry[]>([]);
  const [checkedEntryIds, setCheckedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [entrySaveStates, setEntrySaveStates] = useState<
    Record<string, SaveState>
  >({});
  const [editorFocusRequest, setEditorFocusRequest] = useState<{
    id: number;
    target: "editor";
  }>({ id: 0, target: "editor" });
  const convertPageActive = activePage === "convert";
  const selectedEntryId = selectedEntry?.id ?? null;

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
    const liveEntryIds = new Set(entries.map((entry) => entry.id));
    setEntrySaveStates((current) =>
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
        // override the @media single-column rules below 980px.
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
    lastSidebarClickAtRef.current = -Infinity;
    restoreSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    latestSidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(false);
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  };

  const handleCollapseSidebar = () => {
    restoreSidebarWidthRef.current =
      sidebarWidth ?? measureSidebarWidth() ?? DEFAULT_SIDEBAR_WIDTH;
    setSidebarCollapsed(true);
  };

  const handleShowSidebar = () => {
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

  const workspaceStyle = {
    "--sidebar-width": `${sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH}px`,
  } as CSSProperties & Record<"--sidebar-width", string>;

  const focusPageTab = (page: PageView) => {
    const tab =
      page === "convert" ? convertTabRef.current : installTabRef.current;
    tab?.focus();
  };

  const handleViewTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentPage: PageView,
  ) => {
    const currentIndex = PAGES.indexOf(currentPage);
    let nextPage: PageView | null = null;

    if (event.key === "ArrowRight") {
      nextPage = PAGES[(currentIndex + 1) % PAGES.length];
    } else if (event.key === "ArrowLeft") {
      nextPage = PAGES[(currentIndex - 1 + PAGES.length) % PAGES.length];
    } else if (event.key === "Home") {
      nextPage = PAGES[0];
    } else if (event.key === "End") {
      nextPage = PAGES[PAGES.length - 1];
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

  const handleSave = useCallback(() => {
    if (!isDownloadableEntry(selectedEntry)) {
      return;
    }

    saveState.markSaving();
    downloadEntry(selectedEntry);
    setEntrySaveState(selectedEntry.id, "saved");
    saveState.markSaved();
  }, [saveState, selectedEntry, setEntrySaveState]);

  const saveButtonBusy = saveState.state === "saving";
  const saveButtonDisabled = !isDownloadableEntry(selectedEntry) || saveButtonBusy;

  return (
    <div className="app-shell">
      <main
        className={`page-frame${activeResizeAxis !== null ? " is-resizing" : ""}`}
        style={pageFrameStyle}
      >
        <div className="page">
          <p className="page-version" aria-label="Current release version">
            {DISPLAY_VERSION}
          </p>
          <header className="hero">
            <div className="hero-top">
              <p className="eyebrow">Private markdown workspace</p>
              <div className="hero-actions">
                <ThemeToggle />
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

          <div className="view-switcher-row">
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
              {convertPageActive
                ? heroSummary
                : "CLI, Node, and portable skill setup from one place"}
            </span>
          </div>

          <section
            id="view-panel-convert"
            className="view-panel"
            role="tabpanel"
            aria-labelledby="view-tab-convert"
            hidden={!convertPageActive}
          >
            <section
              className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeResizeAxis !== null ? " is-resizing" : ""}`}
              style={sidebarCollapsed ? undefined : workspaceStyle}
            >
              <span id="split-bar-resize-hint" className="visually-hidden">
                Drag left or right to resize the upload panel. Double-click or
                press Home to reset. Use Arrow Left and Arrow Right for keyboard
                resizing.
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
                        Drop in documents, spreadsheets, PDFs, or presentations,
                        add a doc URL, or start writing from scratch and keep
                        everything in one session.
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

                  <DropZone onFilesAdded={addFiles} onUrlAdded={handleUrlAdded} />

                  <div className="panel-heading panel-heading-tight">
                    <div>
                      <h2>Files</h2>
                      <p className="panel-copy">{fileSummary}</p>
                    </div>
                  </div>

                  <FileList
                    entries={entries}
                    checkedIds={checkedEntryIds}
                    onCheckedChange={toggleCheckedEntry}
                    onClear={handleClear}
                    onDownload={handleDownload}
                    onSelect={selectEntry}
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
                  onSave={handleSave}
                  saveBusy={saveButtonBusy}
                  saveDisabled={saveButtonDisabled}
                  saveState={saveState.state}
                  onMarkdownChange={(text) => {
                    if (selectedEntry) {
                      updateMarkdown(selectedEntry.id, text);
                      setEntrySaveState(selectedEntry.id, "edited");
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
            hidden={convertPageActive}
          >
            <InstallPage active={!convertPageActive} />
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

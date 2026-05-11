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
const MIN_PAGE_MAX_WIDTH = 1360;
const HARD_MAX_PAGE_MAX_WIDTH = 2400;
const PAGE_WIDTH_FRAME_ALLOWANCE = 96;
const PAGE_WIDTH_STEP = 48;
const MIN_EDIT_SHELL_HEIGHT = 240;
const MAX_EDIT_SHELL_HEIGHT = 2400;
const EDIT_SHELL_HEIGHT_STEP = 32;
type PageView = "convert" | "install";
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

function MoveDiagonalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M9 4 H4 V9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 20 H20 V15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 4 L20 20"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

const PAGES: PageView[] = ["convert", "install"];

function clampPageWidth(width: number) {
  if (typeof window === "undefined") {
    return Math.min(
      Math.max(Math.round(width), MIN_PAGE_MAX_WIDTH),
      HARD_MAX_PAGE_MAX_WIDTH,
    );
  }

  const viewportLimitedMax = Math.min(
    HARD_MAX_PAGE_MAX_WIDTH,
    Math.max(MIN_PAGE_MAX_WIDTH, window.innerWidth - PAGE_WIDTH_FRAME_ALLOWANCE),
  );

  return Math.min(
    Math.max(Math.round(width), MIN_PAGE_MAX_WIDTH),
    viewportLimitedMax,
  );
}

function clampEditShellHeight(height: number) {
  return Math.min(
    Math.max(Math.round(height), MIN_EDIT_SHELL_HEIGHT),
    MAX_EDIT_SHELL_HEIGHT,
  );
}

function AppContent() {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPageResizing, setIsPageResizing] = useState(false);
  const [pageMaxWidth, setPageMaxWidth] = useState(BASE_PAGE_MAX_WIDTH);
  const [editShellHeight, setEditShellHeight] = useState<number | null>(null);
  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartWidthRef = useRef(BASE_PAGE_MAX_WIDTH);
  const dragStartHeightRef = useRef<number | null>(null);
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
        setIsPageResizing(false);
        setPageMaxWidth(BASE_PAGE_MAX_WIDTH);
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

  useEffect(() => {
    if (!isPageResizing) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      setPageMaxWidth(
        clampPageWidth(
          dragStartWidthRef.current + (event.clientX - dragStartXRef.current),
        ),
      );
      const baseHeight = dragStartHeightRef.current;
      if (baseHeight !== null) {
        setEditShellHeight(
          clampEditShellHeight(
            baseHeight + (event.clientY - dragStartYRef.current),
          ),
        );
      }
    };
    const handleMouseUp = () => {
      setIsPageResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPageResizing]);

  useEffect(() => {
    document.body.classList.toggle("is-page-resizing", isPageResizing);

    return () => {
      document.body.classList.remove("is-page-resizing");
    };
  }, [isPageResizing]);

  function measureEditShellHeight(): number | null {
    if (typeof document === "undefined") {
      return null;
    }
    const panel = document.querySelector(".preview-panel");
    if (panel) {
      return clampEditShellHeight(panel.getBoundingClientRect().height);
    }
    const shell = document.querySelector(".markdown-edit-shell");
    if (shell) {
      return clampEditShellHeight(shell.getBoundingClientRect().height);
    }
    return MIN_EDIT_SHELL_HEIGHT;
  }

  const handlePageResizeStart = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const normalizedWidth = clampPageWidth(pageMaxWidth);
    const measuredHeight =
      editShellHeight !== null ? editShellHeight : measureEditShellHeight();
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragStartWidthRef.current = normalizedWidth;
    dragStartHeightRef.current = measuredHeight;

    if (normalizedWidth !== pageMaxWidth) {
      setPageMaxWidth(normalizedWidth);
    }
    if (
      measuredHeight !== null &&
      measuredHeight !== editShellHeight
    ) {
      setEditShellHeight(measuredHeight);
    }

    setIsPageResizing(true);
  };

  const handlePageResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPageMaxWidth((current) => clampPageWidth(current + PAGE_WIDTH_STEP));
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPageMaxWidth((current) => clampPageWidth(current - PAGE_WIDTH_STEP));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setEditShellHeight((current) =>
        clampEditShellHeight(
          (current ?? measureEditShellHeight() ?? MIN_EDIT_SHELL_HEIGHT) +
            EDIT_SHELL_HEIGHT_STEP,
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
        ),
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setPageMaxWidth(BASE_PAGE_MAX_WIDTH);
      setEditShellHeight(null);
    }
  };

  const pageFrameStyle = {
    "--page-max-width": `${pageMaxWidth}px`,
  } as CSSProperties;

  const previewPanelStyle =
    editShellHeight !== null
      ? ({
          height: `${editShellHeight}px`,
          minHeight: `${editShellHeight}px`,
        } as CSSProperties)
      : undefined;

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
        className={`page-frame${isPageResizing ? " is-page-resizing" : ""}`}
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
              className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
            >
              {sidebarCollapsed ? (
                <section className="panel collapse-rail" aria-label="Upload rail">
                  <button
                    type="button"
                    className="collapse-rail-button"
                    onClick={() => setSidebarCollapsed(false)}
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
                      onClick={() => setSidebarCollapsed(true)}
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
                className="panel preview-panel"
                aria-labelledby="preview-title"
                style={previewPanelStyle}
              >
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
                <button
                  type="button"
                  className="page-resize-handle"
                  onMouseDown={handlePageResizeStart}
                  onKeyDown={handlePageResizeKeyDown}
                  aria-label="Resize workspace and editor"
                  title="Drag to resize the workspace width and editor height (arrow keys: ←→ width, ↑↓ height, Home reset)"
                >
                  <MoveDiagonalIcon
                    className="page-resize-icon"
                    aria-hidden="true"
                  />
                </button>
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

import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  SVGProps,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import AboutSection from "./components/AboutSection";
import DropZone, { BROWSER_FILE_ACCEPT } from "./components/DropZone";
import FileList from "./components/FileList";
import InstallPage from "./components/InstallPage";
import PreviewPanel from "./components/PreviewPanel";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import WorkingModeBar from "./components/WorkingModeBar";
import { useFileConversion } from "./hooks/useFileConversion";
import { useSaveState } from "./hooks/useSaveState";
import { useWorkspaceResize } from "./shell/useWorkspaceResize";
import type { FileEntry } from "./types";
import type { SaveState } from "./types/saveState";
import { entryDisplayName } from "./utils/displayName";
import { downloadEntry, isDownloadableEntry } from "./utils/download";

// `computeEditShellCeiling` was moved to src/shell/useWorkspaceResize.ts as
// part of the AppShell dedup. Existing test imports (`src/App.test.tsx`)
// continue to work via this re-export to keep the diff to import-site only.
export { computeEditShellCeiling } from "./shell/useWorkspaceResize";

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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

const PAGES: PageView[] = ["convert", "install"];

function AppContent() {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [showLandingChrome, setShowLandingChrome] = useState(false);
  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const browserFileInputRef = useRef<HTMLInputElement | null>(null);
  const previousSelectedEntryIdRef = useRef<string | null>(null);
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
  const resize = useWorkspaceResize();
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
  const convertPageActive = activePage === "convert";
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
    "Start from scratch or with single and mixed-format batches",
    " open",
  );
  const fileSummary = buildSummary("No files or drafts yet.", "");

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Prune per-entry maps when an entry is removed. Functional updaters bail
  // out when nothing was removed, so there is no cascading render in practice.
  useEffect(() => {
    const liveEntryIds = new Set(entries.map((entry) => entry.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prune-stale-keys (see comment above)
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

  // Close the landing chrome when a non-scratch entry becomes selected.
  // Keep this in a post-commit effect (not a during-render guard) so the
  // user can later re-open the landing chrome via the eyebrow toggle while
  // an entry is still selected.
  useEffect(() => {
    if (selectedEntryId !== null && !selectedEntry?.isScratch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close-on-select (see comment above)
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

  // Auto-collapse the upload sidebar the FIRST time the user OPENS a file
  // in this session, delegating the one-shot + media-query + already-touched
  // guards to the shared hook.
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
  }, [selectedEntry?.id, selectedEntry?.isScratch]);

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

  const saveButtonBusy = saveState.state === "saving";
  const saveButtonDisabled = !isDownloadableEntry(selectedEntry) || saveButtonBusy;
  const workingModeBarInertProps = { inert: !isWorkingMode || undefined };
  const landingChromeInertProps = { inert: isWorkingMode || undefined };

  const {
    activeResizeAxis,
    sidebarCollapsed,
    previewPanelRef,
    pageFrameStyle,
    workspaceStyle,
    previewPanelStyle,
    handleShowSidebar,
    handleCollapseSidebar,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
    handleSidebarResizeClickReset,
    handleSidebarResizeMouseUp,
    handleSidebarResizeReset,
    handleHeightResizeStart,
    handleHeightResizeKeyDown,
    handleHeightResizeClickReset,
    handleHeightResizeMouseUp,
    handleHeightResizeReset,
  } = resize;

  // Width inline style only applied when the sidebar is open. The hook owns
  // the default value; we read it as part of the workspaceStyle object.
  const effectiveWorkspaceStyle: CSSProperties | undefined = sidebarCollapsed
    ? undefined
    : workspaceStyle;

  return (
    <div className="app-shell">
      <main
        className={`page-frame${activeResizeAxis !== null ? " is-resizing" : ""}`}
        style={pageFrameStyle}
      >
        <div className={`page${isWorkingMode ? " is-working-mode" : ""}`}>
          <p className="page-version" aria-label="Current release version">
            {DISPLAY_VERSION}
          </p>
          <input
            ref={browserFileInputRef}
            className="visually-hidden"
            type="file"
            accept={BROWSER_FILE_ACCEPT}
            multiple
            onChange={handleBrowserFileInputChange}
          />
          <div
            aria-hidden={!isWorkingMode}
            {...workingModeBarInertProps}
          >
            <WorkingModeBar
              variant="browser"
              onHome={handleReturnHome}
              onOpen={handleBrowserOpenRequest}
              onNew={handleNewDocument}
              trailingControls={<ThemeToggle />}
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
              style={effectiveWorkspaceStyle}
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

                  <DropZone
                    onFilesAdded={addFiles}
                    onUrlAdded={handleUrlAdded}
                    onBrowseRequest={handleBrowserOpenRequest}
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
                  onSave={handleSave}
                  saveBusy={saveButtonBusy}
                  saveDisabled={saveButtonDisabled}
                  saveState={saveState.state}
                  lastSavedAt={
                    selectedEntry ? (entryLastSavedAt[selectedEntry.id] ?? null) : null
                  }
                  onMarkdownChange={(text) => {
                    if (selectedEntry) {
                      updateMarkdown(selectedEntry.id, text);
                      setEntrySaveState(selectedEntry.id, "edited");
                    }
                  }}
                  onLargeMarkdownPaste={handleLargeMarkdownPaste}
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

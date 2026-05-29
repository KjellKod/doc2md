// AppShell dedup Phase 2 — shared layout shell.
//
// The shell renders the page frame, hero, view switcher row, the convert
// workspace (sidebar + preview panel + resize handles + PreviewPanel mount),
// the install view panel, and the About section. Platform-specific UI is
// passed in as slot props by the active adapter (useWebAppShellAdapter or
// useDesktopAppShellAdapter). The shell does not branch on a runtime
// "desktop" vs "web" flag; everything platform-specific is a typed slot.
//
// ThemeProvider placement decision: ThemeProvider STAYS in the shim
// (src/App.tsx and src/desktop/DesktopApp.tsx) so the adapter hooks that
// call useTheme on the desktop side resolve a provided context. This avoids
// a circular dependency where AppShell would need to render the provider
// around state owned by an adapter that itself reads from it.
//
// Negative check (per Phase 2 brief): Sparkle and license UI live in
// apps/macos/**, NOT in this React shell. No React-side surface for those
// exists in this file or any of its callers. Verified via grep at
// build time.

import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
  SVGProps,
} from "react";
import { useId, useRef } from "react";
import AboutSection from "../components/AboutSection";
import DropZone from "../components/DropZone";
import type { DropZoneProps } from "../components/DropZone";
import FileList from "../components/FileList";
import InstallPage from "../components/InstallPage";
import PreviewPanel from "../components/PreviewPanel";
import type { EditorViewState } from "../components/PreviewPanel";
import WorkingModeBar from "../components/WorkingModeBar";
import type { WorkingModeBarProps } from "../components/WorkingModeBar";
import type { FileEntry } from "../types";
import type { SaveState } from "../types/saveState";
import { entryDisplayName } from "../utils/displayName";
import type { ResizeAxis } from "./useWorkspaceResize";

const DISPLAY_VERSION = __DOC2MD_DISPLAY_VERSION__;
const PAGES: PageView[] = ["convert", "install"];

export type PageView = "convert" | "install";

// File list slot props. Both shells render the same FileList component but
// pass slightly different prop shapes (the desktop adapter includes per-entry
// save state for the saved/edited/conflict pills).
export type AppShellFileListProps = {
  entries: FileEntry[];
  checkedIds: Set<string>;
  saveStatuses?: Record<string, SaveState>;
  onCheckedChange: (entryId: string, checked: boolean) => void;
  onClear: () => void;
  onDownload: () => void;
  onSelect: (entryId: string) => void;
  onToggleAllChecked: () => void;
};

// Save controls passed to PreviewPanel inside the workspace. The save state
// machine lives in src/desktop/ (useDesktopSaveState) for the desktop
// adapter, and useSaveState for the web adapter. The shell mounts the
// resulting state via these props; it does not own the state machine.
export type AppShellPreviewPanelSaveProps = {
  saveState: SaveState;
  saveBusy: boolean;
  saveDisabled: boolean;
  saveKeyShortcuts?: string;
  lastSavedAt: number | null;
  onSave: () => void;
  onDownloadMarkdown: () => void;
  downloadMarkdownDisabled: boolean;
  onExportHtml: () => void;
  exportHtmlBusy: boolean;
  exportHtmlDisabled: boolean;
};

// All callbacks the AppShell forwards from the adapter to its rendered
// children. Each callback is named explicitly to satisfy the arbiter's
// slot-contract note 4.
export type AppShellCallbacks = {
  onNewDocument: () => void;
  onReturnHome: () => void;
  onCollapseFromHero: () => void;
  onLargeMarkdownPaste: () => void;
  onMarkdownChange: (text: string) => void;
};

export type AppShellProps = {
  // Shared layout state derived from useWorkspaceResize. The adapter does
  // NOT call the hook; the shim does and passes the relevant pieces down.
  activeResizeAxis: ResizeAxis | null;
  sidebarCollapsed: boolean;
  previewPanelRef: RefObject<HTMLElement | null>;
  pageFrameStyle: CSSProperties;
  workspaceStyle: CSSProperties & Record<"--sidebar-width", string>;
  previewPanelStyle: CSSProperties & Record<"--preview-panel-ceiling", string>;
  handleShowSidebar: () => void;
  handleCollapseSidebar: () => void;
  handleSidebarResizeStart: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleSidebarResizeClickReset: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeMouseUp: (event: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarResizeReset: () => void;
  handleHeightResizeStart: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  handleHeightResizeClickReset: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeMouseUp: (event: MouseEvent<HTMLButtonElement>) => void;
  handleHeightResizeReset: () => void;

  // Shared page state from the consuming shim.
  isWorkingMode: boolean;
  hasWorkingEntry: boolean;
  heroSummary: string;
  fileSummary: string;
  activePage: PageView;
  onActivePageChange: (page: PageView) => void;

  // Selected entry and PreviewPanel wiring.
  selectedEntry: FileEntry | null;
  editorFocusRequest: { id: number; target: "editor" };
  getSavedEditorViewState?: (id: string) => EditorViewState | undefined;
  onEditorViewStateChange?: (id: string, state: EditorViewState) => void;
  previewPanelSaveProps: AppShellPreviewPanelSaveProps;
  callbacks: AppShellCallbacks;

  // Typed component props: AppShell owns the WorkingModeBar render so missing
  // callbacks/data fail at the shell boundary.
  workingModeBarProps: WorkingModeBarProps;

  // Slot: the hero region's trailing actions (theme toggle, optional
  // desktop settings control). The shell renders the eyebrow toggle and
  // tagline; the adapter provides the hero-actions div contents.
  heroActionsSlot: ReactNode;

  // Typed component props: AppShell owns the DropZone render while adapters
  // choose browser file input vs desktop native-open behavior.
  dropZoneProps: DropZoneProps;

  // Slot: a fully-rendered FileList. Both adapters pass the same
  // AppShellFileListProps shape, but the desktop adapter additionally
  // populates saveStatuses; the shell renders this slot inside the panel.
  fileListProps: AppShellFileListProps;

  // Slot: the desktop shell bar (title, save pill, reload/reveal buttons,
  // status/conflict region). Web returns null. Rendered between the view
  // switcher row and the workspace.
  /* type: DesktopStatusProps, includes conflict bar callbacks and save controls. */
  desktopStatusSlot: ReactNode;

  // Slot: hidden controls the shell mounts but does not own. Today this is
  // the hosted-browser hidden file input; desktop returns null. The shell
  // renders this slot at the top of `.page`.
  /* type: InputHTMLAttributes<HTMLInputElement>. */
  hiddenInputSlot: ReactNode;

  // Slot: the DesktopMenuBridge or null. Rendered at the top of the
  // app-shell.
  /* type: DesktopMenuBridgeProps. */
  nativeMenuBridgeSlot: ReactNode;

  // Optional class extension applied to the .hero element. Used by the
  // desktop adapter to mark the hero when the settings popover is open.
  heroClassExtension?: string;

  // Optional class extension applied to the .app-shell root. Used by the
  // hosted adapter to scope hosted-only responsive layout behavior.
  appShellClassExtension?: string;

  // Optional view-switcher-meta override for the install page. Defaults
  // to the canonical static copy below.
  installViewMetaText?: string;
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

export default function AppShell(props: AppShellProps) {
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
    isWorkingMode,
    hasWorkingEntry,
    heroSummary,
    fileSummary,
    activePage,
    onActivePageChange,
    selectedEntry,
    editorFocusRequest,
    getSavedEditorViewState,
    onEditorViewStateChange,
    previewPanelSaveProps,
    callbacks,
    workingModeBarProps,
    heroActionsSlot,
    dropZoneProps,
    fileListProps,
    desktopStatusSlot,
    hiddenInputSlot,
    nativeMenuBridgeSlot,
    heroClassExtension,
    appShellClassExtension,
    installViewMetaText,
  } = props;

  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const eyebrowTooltipId = useId();
  const showSidebarTooltipId = useId();
  const hideSidebarTooltipId = useId();
  const splitBarTooltipId = useId();
  const previewHeightTooltipId = useId();
  const convertPageActive = activePage === "convert";
  const workingModeBarInertProps = { inert: !isWorkingMode || undefined };
  const landingChromeInertProps = { inert: isWorkingMode || undefined };
  const effectiveWorkspaceStyle: CSSProperties | undefined = sidebarCollapsed
    ? undefined
    : workspaceStyle;
  const heroClassName = `hero${heroClassExtension ? ` ${heroClassExtension}` : ""}`;
  const appShellClassName = `app-shell${isWorkingMode ? " app-shell-working-mode" : ""}${appShellClassExtension ? ` ${appShellClassExtension}` : ""}`;

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
    onActivePageChange(nextPage);
    focusPageTab(nextPage);
  };

  return (
    <div className={appShellClassName}>
      {nativeMenuBridgeSlot}
      <main
        className={`page-frame${activeResizeAxis !== null ? " is-resizing" : ""}`}
        style={pageFrameStyle}
      >
        <div className={`page${isWorkingMode ? " is-working-mode" : ""}`}>
          <p className="page-version" aria-label="Current release version">
            {DISPLAY_VERSION}
          </p>
          {hiddenInputSlot}
          <div aria-hidden={!isWorkingMode} {...workingModeBarInertProps}>
            <WorkingModeBar {...workingModeBarProps} />
          </div>
          <header
            className={heroClassName}
            aria-hidden={isWorkingMode}
            {...landingChromeInertProps}
          >
            <div className="hero-top">
              <button
                type="button"
                className="eyebrow eyebrow-toggle instant-tooltip-anchor"
                aria-label={
                  hasWorkingEntry
                    ? "Hide intro and return to editor"
                    : "doc2md, private markdown workspace"
                }
                aria-disabled={!hasWorkingEntry}
                aria-describedby={hasWorkingEntry ? eyebrowTooltipId : undefined}
                onClick={callbacks.onCollapseFromHero}
              >
                <span className="eyebrow-brand">doc2md</span>
                <span className="eyebrow-sep" aria-hidden="true"> - </span>
                <span className="eyebrow-tagline">PRIVATE MARKDOWN WORKSPACE</span>
                {hasWorkingEntry ? (
                  <span
                    id={eyebrowTooltipId}
                    role="tooltip"
                    className="instant-tooltip instant-tooltip--left"
                  >
                    Hide intro and return to editor
                  </span>
                ) : null}
              </button>
              <div className="hero-actions">{heroActionsSlot}</div>
            </div>
            <h1>
              {"Start writing or convert files to "}
              <br />
              {"Markdown."}
            </h1>
            <p className="hero-copy">
              Privacy first. Start with a blank draft, edit existing Markdown,
              open files, or convert{" "}
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
                onClick={() => onActivePageChange("convert")}
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
                onClick={() => onActivePageChange("install")}
                onKeyDown={(event) => handleViewTabKeyDown(event, "install")}
              >
                Install & Use
              </button>
            </div>
            <span className="view-switcher-meta" aria-live="polite">
              {convertPageActive
                ? heroSummary
                : (installViewMetaText ??
                  "CLI, Node, and portable skill setup from one place")}
            </span>
          </div>

          <section
            id="view-panel-convert"
            className="view-panel"
            role="tabpanel"
            aria-labelledby="view-tab-convert"
            hidden={!convertPageActive}
          >
            {desktopStatusSlot}
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
                <section
                  className="panel collapse-rail instant-tooltip-anchor"
                  aria-label="Upload rail"
                >
                  <button
                    type="button"
                    className="collapse-rail-button"
                    onClick={handleShowSidebar}
                    aria-label="Show upload panel"
                    aria-describedby={showSidebarTooltipId}
                  >
                    <PanelRightOpenIcon
                      className="collapse-toggle-icon"
                      aria-hidden="true"
                    />
                    <span className="collapse-rail-label">Upload</span>
                  </button>
                  <span
                    id={showSidebarTooltipId}
                    role="tooltip"
                    className="instant-tooltip collapse-rail-tooltip"
                  >
                    Show upload panel
                  </span>
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
                        Drop files, open files, or start writing
                        from scratch.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button collapse-toggle instant-tooltip-anchor"
                      onClick={handleCollapseSidebar}
                      aria-label="Hide upload panel"
                      aria-describedby={hideSidebarTooltipId}
                    >
                      <PanelRightCloseIcon
                        className="collapse-toggle-icon"
                        aria-hidden="true"
                      />
                      <span
                        id={hideSidebarTooltipId}
                        role="tooltip"
                        className="instant-tooltip instant-tooltip--left"
                      >
                        Hide upload panel
                      </span>
                    </button>
                  </div>

                  <DropZone {...dropZoneProps} />

                  <div className="panel-heading panel-heading-tight">
                    <div>
                      <h2>Files</h2>
                      <p className="panel-copy">{fileSummary}</p>
                    </div>
                  </div>

                  <FileListInline {...fileListProps} />
                </section>
              )}

              <section
                ref={previewPanelRef}
                className="panel preview-panel"
                aria-labelledby="preview-title"
                style={previewPanelStyle}
              >
                {!sidebarCollapsed ? (
                  <>
                    <button
                      type="button"
                      className="workspace-split-bar"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize upload panel"
                      aria-describedby={`split-bar-resize-hint ${splitBarTooltipId}`}
                      onMouseDown={handleSidebarResizeStart}
                      onMouseUp={handleSidebarResizeMouseUp}
                      onClick={handleSidebarResizeClickReset}
                      onDoubleClick={handleSidebarResizeReset}
                      onKeyDown={handleSidebarResizeKeyDown}
                    />
                    <span
                      id={splitBarTooltipId}
                      role="tooltip"
                      className="instant-tooltip resize-handle-tooltip resize-handle-tooltip--split"
                    >
                      Drag to resize the upload panel; double-click to reset
                    </span>
                  </>
                ) : null}
                <div className="panel-heading">
                  <div>
                    <h2 id="preview-title">Preview</h2>
                    <p className="panel-copy">
                      {selectedEntry
                        ? entryDisplayName(selectedEntry)
                        : "Markdown preview appears here."}
                    </p>
                  </div>
                </div>
                <PreviewPanel
                  entry={selectedEntry}
                  onStartWriting={callbacks.onNewDocument}
                  onNewDocument={callbacks.onNewDocument}
                  editorFocusRequest={editorFocusRequest}
                  getSavedEditorViewState={getSavedEditorViewState}
                  onEditorViewStateChange={onEditorViewStateChange}
                  onSave={previewPanelSaveProps.onSave}
                  saveBusy={previewPanelSaveProps.saveBusy}
                  saveDisabled={previewPanelSaveProps.saveDisabled}
                  saveKeyShortcuts={previewPanelSaveProps.saveKeyShortcuts}
                  saveState={previewPanelSaveProps.saveState}
                  lastSavedAt={previewPanelSaveProps.lastSavedAt}
                  onDownloadMarkdown={previewPanelSaveProps.onDownloadMarkdown}
                  downloadMarkdownDisabled={
                    previewPanelSaveProps.downloadMarkdownDisabled
                  }
                  onExportHtml={previewPanelSaveProps.onExportHtml}
                  exportHtmlBusy={previewPanelSaveProps.exportHtmlBusy}
                  exportHtmlDisabled={previewPanelSaveProps.exportHtmlDisabled}
                  onMarkdownChange={callbacks.onMarkdownChange}
                  onLargeMarkdownPaste={callbacks.onLargeMarkdownPaste}
                />
                {selectedEntry ? (
                  <>
                    <button
                      type="button"
                      className="preview-height-handle"
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize editor height"
                      aria-describedby={`preview-height-resize-hint ${previewHeightTooltipId}`}
                      onMouseDown={handleHeightResizeStart}
                      onMouseUp={handleHeightResizeMouseUp}
                      onClick={handleHeightResizeClickReset}
                      onDoubleClick={handleHeightResizeReset}
                      onKeyDown={handleHeightResizeKeyDown}
                    />
                    <span
                      id={previewHeightTooltipId}
                      role="tooltip"
                      className="instant-tooltip resize-handle-tooltip resize-handle-tooltip--height"
                    >
                      Drag to resize the editor height; double-click to reset
                    </span>
                  </>
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

// Small inline wrapper: the shell renders FileList here. The desktop
// adapter passes saveStatuses, the web adapter omits it; both adapters
// consume the same prop shape.
function FileListInline(props: AppShellFileListProps) {
  return <FileList {...props} />;
}

import type { CSSProperties, KeyboardEvent, MouseEvent, SVGProps } from "react";
import { useEffect, useRef, useState } from "react";
import corePackage from "../packages/core/package.json";
import AboutSection from "./components/AboutSection";
import DownloadButton from "./components/DownloadButton";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import InstallPage from "./components/InstallPage";
import PreviewPanel from "./components/PreviewPanel";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";
import { useFileConversion } from "./hooks/useFileConversion";
import { entryDisplayName } from "./utils/displayName";
import { downloadAllEntries, isDownloadableEntry } from "./utils/download";

const BASE_PAGE_MAX_WIDTH = 1680;
const MIN_PAGE_MAX_WIDTH = 1360;
const HARD_MAX_PAGE_MAX_WIDTH = 2400;
const PAGE_WIDTH_FRAME_ALLOWANCE = 96;
const PAGE_WIDTH_STEP = 48;
type PageView = "convert" | "install";
const RELEASE_VERSION = `v${corePackage.version}`;

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

function MoveHorizontalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="m7 8-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m17 8 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12h18"
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

export default function App() {
  const [activePage, setActivePage] = useState<PageView>("convert");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPageResizing, setIsPageResizing] = useState(false);
  const [pageMaxWidth, setPageMaxWidth] = useState(BASE_PAGE_MAX_WIDTH);
  const convertTabRef = useRef<HTMLButtonElement>(null);
  const installTabRef = useRef<HTMLButtonElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(BASE_PAGE_MAX_WIDTH);
  const {
    entries,
    addFiles,
    addUrl,
    addScratchEntry,
    clearEntries,
    selectEntry,
    selectedEntry,
    updateMarkdown,
  } = useFileConversion();
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

  const handlePageResizeStart = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const normalizedWidth = clampPageWidth(pageMaxWidth);
    dragStartXRef.current = event.clientX;
    dragStartWidthRef.current = normalizedWidth;

    if (normalizedWidth !== pageMaxWidth) {
      setPageMaxWidth(normalizedWidth);
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

    if (event.key === "Home") {
      event.preventDefault();
      setPageMaxWidth(BASE_PAGE_MAX_WIDTH);
    }
  };

  const pageFrameStyle = {
    "--page-max-width": `${pageMaxWidth}px`,
  } as CSSProperties;

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

  return (
    <ThemeProvider>
      <div className="app-shell">
        <main
          className={`page-frame${isPageResizing ? " is-page-resizing" : ""}`}
          style={pageFrameStyle}
        >
          <div className="page">
            <header className="hero">
              <div className="hero-top">
                <p className="eyebrow">Private markdown workspace</p>
                <div className="hero-actions">
                  <p className="hero-version" aria-label="Current release version">
                    {RELEASE_VERSION}
                  </p>
                  <ThemeToggle />
                </div>
              </div>
              <h1>Edit or convert to Markdown, without leaving the browser.</h1>
              <p className="hero-copy">
                Start with a blank draft, paste in existing content, or bring in
                a local file or document URL to convert in your browser before
                you review and download clean Markdown.
              </p>
              <div className="hero-meta" aria-label="Product highlights">
                <span className="hero-pill">
                  Browser-side conversion with no doc2md upload backend
                </span>
                <span className="hero-pill">
                  Supports .md, .txt, .json, .csv, .tsv, .html, .docx, .xlsx,
                  .pdf, and .pptx
                </span>
                <span className="hero-pill">
                  {activePage === "convert"
                    ? heroSummary
                    : "CLI, Node, and portable skill setup from one place"}
                </span>
              </div>
            </header>

            <div className="view-switcher" role="tablist" aria-label="doc2md views">
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

            <section
              id="view-panel-convert"
              className="view-panel"
              role="tabpanel"
              aria-labelledby="view-tab-convert"
              hidden={activePage !== "convert"}
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
                          Drop in documents, spreadsheets, PDFs, or
                          presentations, add a doc URL, or start writing from
                          scratch and keep everything in one session.
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

                    <DropZone
                      onFilesAdded={addFiles}
                      onUrlAdded={handleUrlAdded}
                    />

                    <div className="panel-heading panel-heading-tight">
                      <div>
                        <h2>Files</h2>
                        <p className="panel-copy">{fileSummary}</p>
                      </div>
                      <DownloadButton entry={selectedEntry} />
                    </div>

                    <FileList
                      entries={entries}
                      onClearAll={clearEntries}
                      onDownloadAll={() => downloadAllEntries(entries)}
                      onSelect={selectEntry}
                    />
                  </section>
                )}

                <section
                  className="panel preview-panel"
                  aria-labelledby="preview-title"
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
                    <button
                      type="button"
                      className="ghost-button page-width-handle"
                      onMouseDown={handlePageResizeStart}
                      onKeyDown={handlePageResizeKeyDown}
                      aria-label="Resize workspace width"
                      title="Drag to widen or narrow the workspace"
                    >
                      <MoveHorizontalIcon
                        className="page-width-icon"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <PreviewPanel
                    entry={selectedEntry}
                    onStartWriting={addScratchEntry}
                    onMarkdownChange={(text) => {
                      if (selectedEntry) {
                        updateMarkdown(selectedEntry.id, text);
                      }
                    }}
                  />
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
    </ThemeProvider>
  );
}

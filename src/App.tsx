import { MoveHorizontal, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import AboutSection from "./components/AboutSection";
import DownloadButton from "./components/DownloadButton";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPageResizing, setIsPageResizing] = useState(false);
  const [pageMaxWidth, setPageMaxWidth] = useState(BASE_PAGE_MAX_WIDTH);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(BASE_PAGE_MAX_WIDTH);
  const {
    entries,
    addFiles,
    addScratchEntry,
    clearEntries,
    selectEntry,
    selectedEntry,
    updateMarkdown,
  } = useFileConversion();
  const convertedCount = entries.filter(
    (entry) => isDownloadableEntry(entry) && !entry.isScratch,
  ).length;
  const draftCount = entries.filter((entry) => entry.isScratch).length;
  const activeCount = entries.filter(
    (entry) => entry.status === "pending" || entry.status === "converting",
  ).length;
  const heroSummary =
    entries.length === 0
      ? "Start from scratch or with single and mixed-format batches"
      : [
          convertedCount > 0
            ? `${convertedCount} ${pluralize(convertedCount, "converted file")}`
            : null,
          activeCount > 0 ? `${activeCount} processing` : null,
          draftCount > 0
            ? `${draftCount} ${pluralize(draftCount, "draft")} open`
            : null,
        ]
          .filter(Boolean)
          .join(", ") ||
        `${entries.length} ${pluralize(entries.length, "entry")} in session`;
  const fileSummary =
    entries.length === 0
      ? "No files or drafts yet."
      : [
          convertedCount > 0
            ? `${convertedCount} ${pluralize(convertedCount, "converted file")}`
            : null,
          draftCount > 0
            ? `${draftCount} ${pluralize(draftCount, "draft")}`
            : null,
          activeCount > 0 ? `${activeCount} processing` : null,
        ]
          .filter(Boolean)
          .join(", ") ||
        `${entries.length} ${pluralize(entries.length, "entry")} in session`;

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
                <ThemeToggle />
              </div>
              <h1>Edit or convert to Markdown, without leaving the browser.</h1>
              <p className="hero-copy">
                Start with a blank draft, paste in existing content, or drop in a
                file to convert locally before you review and download clean
                Markdown.
              </p>
              <div className="hero-meta" aria-label="Product highlights">
                <span className="hero-pill">
                  Private by design: your files never leave your browser
                </span>
                <span className="hero-pill">
                  Supports .md, .txt, .json, .csv, .tsv, .html, .docx, .xlsx,
                  .pdf, and .pptx
                </span>
                <span className="hero-pill">{heroSummary}</span>
              </div>
            </header>

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
                    <PanelRightOpen className="collapse-toggle-icon" aria-hidden="true" />
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
                        or start writing from scratch and keep everything in one
                        session.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button collapse-toggle"
                      onClick={() => setSidebarCollapsed(true)}
                      aria-label="Hide upload panel"
                      title="Hide upload panel"
                    >
                      <PanelRightClose className="collapse-toggle-icon" aria-hidden="true" />
                      <span className="collapse-toggle-label">Hide Panel</span>
                    </button>
                  </div>

                  <DropZone onFilesAdded={addFiles} />

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

              <div className="preview-shell">
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

                <aside className="page-width-rail" aria-label="Workspace width controls">
                  <button
                    type="button"
                    className="page-width-handle"
                    onMouseDown={handlePageResizeStart}
                    onKeyDown={handlePageResizeKeyDown}
                    aria-label="Resize workspace width"
                    title="Drag to widen or narrow the workspace"
                  >
                    <MoveHorizontal className="page-width-icon" aria-hidden="true" />
                  </button>
                </aside>
              </div>
            </section>

            <AboutSection />
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

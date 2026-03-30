import AboutSection from "./components/AboutSection";
import DownloadButton from "./components/DownloadButton";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import PreviewPanel from "./components/PreviewPanel";
import { entryDisplayName } from "./utils/displayName";
import { useFileConversion } from "./hooks/useFileConversion";
import { downloadAllEntries, isDownloadableEntry } from "./utils/download";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export default function App() {
  const {
    entries,
    addFiles,
    addScratchEntry,
    clearEntries,
    selectEntry,
    selectedEntry,
    updateMarkdown,
  } = useFileConversion();
  const completedCount = entries.filter(isDownloadableEntry).length;
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

  return (
    <div className="app-shell">
      <main className="page">
        <header className="hero">
          <p className="eyebrow">Private markdown workspace</p>
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
              Supports .md, .txt, .json, .csv, .tsv, .html, .docx, .xlsx, .pdf,
              and .pptx
            </span>
            <span className="hero-pill">{heroSummary}</span>
          </div>
        </header>

        <section className="workspace">
          <section
            className="panel sidebar-panel"
            aria-labelledby="upload-title"
          >
            <div className="panel-heading">
              <div>
                <h2 id="upload-title">Upload</h2>
                <p className="panel-copy">
                  Drop in documents, spreadsheets, PDFs, or presentations, or
                  start writing from scratch and keep everything in one session.
                </p>
              </div>
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
                if (selectedEntry) updateMarkdown(selectedEntry.id, text);
              }}
            />
          </section>
        </section>

        <AboutSection />
      </main>
    </div>
  );
}

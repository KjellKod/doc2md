import AboutSection from "./components/AboutSection";
import DownloadButton from "./components/DownloadButton";
import DropZone from "./components/DropZone";
import FileList from "./components/FileList";
import PreviewPanel from "./components/PreviewPanel";
import { useFileConversion } from "./hooks/useFileConversion";
import { downloadAllEntries, isDownloadableEntry } from "./utils/download";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export default function App() {
  const { entries, addFiles, clearEntries, selectEntry, selectedEntry, updateMarkdown } =
    useFileConversion();
  const completedCount = entries.filter(isDownloadableEntry).length;
  const activeCount = entries.filter(
    (entry) => entry.status === "pending" || entry.status === "converting"
  ).length;

  return (
    <div className="app-shell">
      <main className="page">
        <header className="hero">
          <p className="eyebrow">Local document conversion</p>
          <h1>Document to Markdown, without leaving the browser.</h1>
          <p className="hero-copy">
            Drop in a file, convert it locally, review the result, and download
            Markdown.
          </p>
          <div className="hero-meta" aria-label="Product highlights">
            <span className="hero-pill">
              Files are processed locally in your browser
            </span>
            <span className="hero-pill">
              Supports .txt, .json, .csv, .tsv, .html, .docx, .xlsx, .pdf, and .pptx
            </span>
            <span className="hero-pill">
              {entries.length === 0
                ? "Ready for single or mixed-format batches"
                : `${completedCount} ${pluralize(completedCount, "file")} ready, ${activeCount} processing`}
            </span>
          </div>
        </header>

        <section className="workspace">
          <section className="panel sidebar-panel" aria-labelledby="upload-title">
            <div className="panel-heading">
              <div>
                <h2 id="upload-title">Upload</h2>
                <p className="panel-copy">
                  Drop in supported documents, spreadsheets, PDFs, or decks and
                  review the Markdown before downloading it.
                </p>
              </div>
            </div>
            <DropZone onFilesAdded={addFiles} />

            <div className="panel-heading panel-heading-tight">
              <div>
                <h2>Files</h2>
                <p className="panel-copy">
                  {entries.length === 0
                    ? "No files yet."
                    : `${entries.length} ${pluralize(entries.length, "file")}, ${completedCount} ready`}
                </p>
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

          <section className="panel preview-panel" aria-labelledby="preview-title">
            <div className="panel-heading">
              <div>
                <h2 id="preview-title">Preview</h2>
                <p className="panel-copy">
                  {selectedEntry
                    ? selectedEntry.name
                    : "Drop files to convert and review the rendered Markdown here."}
                </p>
              </div>
            </div>
            <PreviewPanel
              entry={selectedEntry}
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

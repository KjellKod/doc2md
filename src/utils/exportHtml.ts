import type { FileEntry } from "../types";

// App-side HTML export helper. The renderer (unified/remark/rehype) is
// lazy-imported on the export action only, so it never lands in the initial
// app bundle. Export always re-renders from the stored Markdown — it never
// scrapes the live preview DOM.
export async function renderEntryHtml(entry: FileEntry): Promise<string> {
  const { markdownToHtml } = await import("../render/markdownToHtml");
  const markdown = entry.editedMarkdown ?? entry.markdown;
  return markdownToHtml(markdown, {
    standalone: true,
    title: titleFromEntryName(entry.name),
  });
}

function titleFromEntryName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  return base.trim() || name;
}

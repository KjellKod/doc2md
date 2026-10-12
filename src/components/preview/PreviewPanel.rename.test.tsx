import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewPanel from "./PreviewPanel";
import type { FileEntry } from "../../types";

afterEach(cleanup);
describe("renaming an open document", () => {
  it.each([undefined, true])(
    "preserves editing and selection when isScratch changes from %s to false",
    (isScratch) => {
      const entry: FileEntry = {
        id: "open",
        file: new File(["# Original"], "original.md"),
        name: "original.md",
        format: "md",
        status: "success",
        markdown: "# Original",
        editedMarkdown: "# Edited content",
        warnings: [],
        selected: true,
        isScratch,
      };
      const onMarkdownChange = vi.fn();
      const { rerender } = render(
        <PreviewPanel entry={entry} onMarkdownChange={onMarkdownChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const editor = screen.getByRole("textbox", {
        name: "Edit markdown",
      }) as HTMLTextAreaElement;
      editor.focus();
      editor.setSelectionRange(2, 8);
      rerender(
        <PreviewPanel
          entry={{ ...entry, name: "renamed.md", isScratch: false }}
          onMarkdownChange={onMarkdownChange}
        />,
      );
      expect(screen.getByRole("textbox", { name: "Edit markdown" })).toBe(
        editor,
      );
      expect(editor).toHaveValue("# Edited content");
      expect(editor.selectionStart).toBe(2);
      expect(editor.selectionEnd).toBe(8);
      expect(editor).toHaveFocus();
    },
  );
});


describe("combined toolbar availability", () => {
  it("leaves browser Find available while the document workspace is hidden", () => {
    const entry: FileEntry = { id: "hidden", file: new File(["# Notes"], "notes.md"), name: "notes.md", format: "md", status: "success", markdown: "# Notes", warnings: [], selected: true };
    const { rerender } = render(<PreviewPanel entry={entry} documentControlsVisible={false} />);
    const shortcut = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
    rerender(<PreviewPanel entry={entry} documentControlsVisible />);
    const activeShortcut = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true });
    fireEvent(window, activeShortcut);
    expect(activeShortcut.defaultPrevented).toBe(true);
  });
  it("keeps the download icon disabled when no document is open", () => {
    const host = document.createElement("header");
    document.body.appendChild(host);
    render(<PreviewPanel entry={null} toolbarTarget={host} outputMode="download" onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Download Markdown" })).toBeDisabled();
    expect(screen.queryByText("Ready to download")).not.toBeInTheDocument();
    host.remove();
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PreviewPanel from "../PreviewPanel";
import type { FileEntry } from "../../types";

function scratchEntry(markdown: string): FileEntry {
  return {
    id: "scratch-ime",
    name: "Untitled.md",
    file: new File([markdown], "Untitled.md", { type: "text/markdown" }),
    status: "success",
    format: "md",
    markdown,
    editedMarkdown: markdown,
    warnings: [],
    isScratch: true,
    selected: true,
  } as FileEntry;
}

describe("PreviewPanel auto-continue + IME guard", () => {
  it.each([false, true])(
    "does not auto-continue while IME composition is active with line numbers %s",
    (showLineNumbers) => {
      const onChange = vi.fn();
      render(
        <PreviewPanel
          entry={scratchEntry("- foo")}
          onMarkdownChange={onChange}
        />,
      );

      if (showLineNumbers) {
        fireEvent.click(screen.getByRole("button", { name: "Line numbers" }));
      }

      const textarea = screen.getByRole("textbox", {
        name: "Edit markdown",
      }) as HTMLTextAreaElement;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      fireEvent.compositionStart(textarea);
      fireEvent.keyDown(textarea, {
        key: "Enter",
        bubbles: true,
        // Simulate a composing keydown by spreading nativeEvent isComposing flag.
        nativeEvent: new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
        }),
      });

      expect(onChange).not.toHaveBeenCalled();

      fireEvent.compositionEnd(textarea);
      fireEvent.keyDown(textarea, {
        key: "Enter",
        bubbles: true,
        nativeEvent: new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: false,
        }),
      });

      expect(onChange).toHaveBeenCalledWith("- foo\n- ");
    },
  );
});

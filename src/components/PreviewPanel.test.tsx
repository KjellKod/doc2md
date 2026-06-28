import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversionQuality } from "../converters/types";
import type { FileEntry } from "../types";
import PreviewPanel from "./PreviewPanel";
import type { EditorViewState } from "./PreviewPanel";
import {
  LARGE_JSON_MARKDOWN_THRESHOLD,
  LARGE_JSON_PREVIEW_CHARACTER_LIMIT,
  getLargeJsonPreview,
} from "./preview/largeJsonPreview";
import * as viewportAnchor from "./viewportAnchor";

class MockClipboardItem {
  readonly types: string[];
  private readonly items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
    this.types = Object.keys(items);
  }

  async getType(type: string) {
    const item = this.items[type];

    if (!item) {
      throw new Error(`Unknown clipboard type: ${type}`);
    }

    return item;
  }
}

class MockBlob {
  readonly type: string;
  private readonly content: string;

  constructor(parts: unknown[], options?: { type?: string }) {
    this.content = parts.map((part) => String(part)).join("");
    this.type = options?.type ?? "";
  }

  async text() {
    return this.content;
  }
}

const REVIEW_QUALITY: ConversionQuality = {
  level: "review",
  summary:
    "Review: Text was extracted, but layout may be fragmented or out of reading order.",
};

function createEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "test-1",
    file: new File([""], "test.txt"),
    name: "test.txt",
    format: "txt",
    status: "success",
    markdown: "# Hello World",
    warnings: [],
    selected: true,
    ...overrides,
  };
}

function createLargeMarkdownTable(rowCount = 1_100): string {
  const rows = ["# Report", "", "| Package | License | Notes |", "| --- | --- | --- |"];
  for (let index = 0; index < rowCount; index += 1) {
    const notes =
      index === 0 ? "[docs](https://example.com/docs)" : "metadata ".repeat(8);
    rows.push(`| package-${index} | MIT | ${notes} |`);
  }
  return rows.join("\n");
}

function fireEditorPaste(
  editor: HTMLElement,
  {
    html = "",
    plainText = "",
  }: {
    html?: string;
    plainText?: string;
  },
) {
  fireEvent.paste(editor, {
    clipboardData: {
      getData: (type: string) => {
        if (type === "text/html") return html;
        if (type === "text/plain") return plainText;
        return "";
      },
    },
  });
}

function ControlledPreviewPanel({
  initialMarkdown,
}: {
  initialMarkdown: string;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);

  return (
    <PreviewPanel
      entry={createEntry({ markdown, editedMarkdown: markdown })}
      onMarkdownChange={setMarkdown}
    />
  );
}

function createLargeJsonMarkdown() {
  const padding = "x".repeat(LARGE_JSON_MARKDOWN_THRESHOLD);
  return `\`\`\`json\n{"earlyKey":true,"body":"${padding}","tailKey":true}\n\`\`\``;
}

afterEach(() => {
  cleanup();
});

const originalClipboardItem = globalThis.ClipboardItem;
const originalBlob = globalThis.Blob;
const originalExecCommand = document.execCommand;
let clipboardWriteText: ReturnType<typeof vi.fn>;
let clipboardWrite: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  clipboardWriteText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(globalThis, "ClipboardItem", {
    configurable: true,
    value: MockClipboardItem,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: clipboardWrite, writeText: clipboardWriteText },
  });
  vi.useRealTimers();
});

afterEach(() => {
  Object.defineProperty(globalThis, "ClipboardItem", {
    configurable: true,
    value: originalClipboardItem,
  });
  Object.defineProperty(globalThis, "Blob", {
    configurable: true,
    value: originalBlob,
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: originalExecCommand,
  });
});

describe("PreviewPanel", () => {
  it("detects only large generated JSON fenced Markdown for lightweight preview", () => {
    const largeJson = createLargeJsonMarkdown();

    expect(getLargeJsonPreview(largeJson)).toMatchObject({
      totalCharacters: expect.any(Number),
      shownCharacters: LARGE_JSON_PREVIEW_CHARACTER_LIMIT,
    });
    expect(getLargeJsonPreview("```json\n{}\n```")).toBeNull();
    expect(getLargeJsonPreview(`# ${"x".repeat(LARGE_JSON_MARKDOWN_THRESHOLD)}`)).toBeNull();
    expect(getLargeJsonPreview(`\`\`\`js\n${"x".repeat(LARGE_JSON_MARKDOWN_THRESHOLD)}\n\`\`\``)).toBeNull();
    expect(getLargeJsonPreview(`\`\`\`json\n${"x".repeat(LARGE_JSON_MARKDOWN_THRESHOLD)}`)).toBeNull();
  });

  it("uses a lightweight preview for large generated JSON and returns to it from Edit", async () => {
    const markdown = createLargeJsonMarkdown();
    const topLineFromTextareaMirror = vi.spyOn(
      viewportAnchor,
      "topLineFromTextareaMirror",
    );

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            name: "inventory.json",
            format: "json",
            markdown,
          })}
        />,
      );

      expect(screen.getByTestId("large-json-preview")).toBeInTheDocument();
      expect(screen.getByTestId("large-json-preview")).toHaveTextContent(
        "earlyKey",
      );
      expect(screen.getByTestId("large-json-preview")).not.toHaveTextContent(
        "tailKey",
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const editor = await screen.findByLabelText("Edit markdown");
      expect((editor as HTMLTextAreaElement).value.length).toBe(markdown.length);
      expect((editor as HTMLTextAreaElement).value).toContain("earlyKey");

      fireEvent.click(screen.getByRole("button", { name: "View" }));
      await waitFor(() => {
        expect(screen.getByTestId("large-json-preview")).toBeInTheDocument();
      });
      expect(screen.getByTestId("large-json-preview")).not.toHaveTextContent(
        "tailKey",
      );
      expect(topLineFromTextareaMirror).not.toHaveBeenCalled();
    } finally {
      topLineFromTextareaMirror.mockRestore();
    }
  });

  it("marks Markdown download busy and disabled", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onDownloadMarkdown={() => undefined}
        downloadMarkdownBusy
      />,
    );

    const button = screen.getByRole("button", { name: "Download Markdown" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("restructures dense metadata blocks in preview mode", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: [
            "Contact",
            "Location: Chihuahua, Mexico",
            "Email: javier@example.com",
            "LinkedIn: https://example.com/in/javier",
            "Github: https://github.com/javier",
          ].join("\n"),
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Contact" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText(/Location:/)).toBeInTheDocument();
    expect(screen.getByText(/Email:/)).toBeInTheDocument();
  });

  it("renders toggle buttons when entry is success with markdown", () => {
    render(<PreviewPanel entry={createEntry()} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LinkedIn" })).toHaveAttribute(
      "aria-describedby",
      "linkedin-toggle-tooltip",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Unicode formatting for easy LinkedIn posting",
    );
  });

  it("shows only verified editor shortcuts in the compact reference", () => {
    render(<PreviewPanel entry={createEntry()} />);

    const shortcutsButton = screen.getByRole("button", {
      name: "Keyboard shortcuts",
    });
    expect(shortcutsButton).toHaveClass("shortcut-reference-button");
    expect(shortcutsButton).not.toHaveAttribute("title");
    expect(shortcutsButton).toHaveTextContent("");

    fireEvent.click(shortcutsButton);

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveTextContent("Find");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+F");
    expect(dialog).toHaveTextContent("Bold");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+B");
    expect(dialog).toHaveTextContent("Italic");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+I");
    expect(dialog).toHaveTextContent("Link");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+K");
    expect(dialog).toHaveTextContent("Ordered list");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+Shift+7");
    expect(dialog).toHaveTextContent("Bulleted list");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+Shift+8");
    expect(dialog).toHaveTextContent("Task list");
    expect(dialog).toHaveTextContent("Cmd/Ctrl+Shift+9");
    expect(dialog).toHaveTextContent("Close find or menu");
    expect(dialog).toHaveTextContent("Escape");
    expect(dialog).not.toHaveTextContent("Save document");
    expect(dialog).not.toHaveTextContent("Mode switch");
  });

  it("adds Save to the shortcut reference only when the shell exposes a save shortcut", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onSave={() => undefined}
        saveKeyShortcuts="Meta+S"
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save document" });
    const shortcutsButton = screen.getByRole("button", {
      name: "Keyboard shortcuts",
    });
    expect(
      saveButton.compareDocumentPosition(shortcutsButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveTextContent("Save document");
    expect(dialog).toHaveTextContent("Cmd+S");
  });

  it("closes the shortcut reference on Escape and returns focus", async () => {
    render(<PreviewPanel entry={createEntry()} />);

    const button = screen.getByRole("button", { name: "Keyboard shortcuts" });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Keyboard shortcuts" }),
      ).not.toBeInTheDocument();
      expect(button).toHaveFocus();
    });
  });

  it("renders toggle buttons when entry is warning with markdown", () => {
    render(
      <PreviewPanel
        entry={createEntry({ status: "warning", warnings: ["Some warning"] })}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("keeps ordinary GFM tables on the rich preview path", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "md",
          markdown: [
            "| Name | Score |",
            "| --- | --- |",
            "| Ada | 10 |",
          ].join("\n"),
        })}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Large report preview")).not.toBeInTheDocument();
  });

  it("renders large table-heavy Markdown as a full document view", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "md",
          name: "report.main.md",
          markdown: [
            createLargeMarkdownTable(),
            "",
            "## Coverage Gaps",
            "",
            "- `empty_resolved_file: work/android/resolved.ndjson`",
          ].join("\n"),
        })}
      />,
    );

    expect(screen.getByText("Large report")).toBeInTheDocument();
    expect(
      screen.getByText(/Rendering the document with a virtualized table/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Rich table rendering skipped/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Report" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Package" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
    expect(screen.getByText("package-0")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Coverage Gaps" }),
    ).toBeInTheDocument();
  });

  it("renders interactive table-cell checkboxes in the large-document fallback path", async () => {
    // A large, table-heavy doc that trips useFallbackPreview AND carries
    // checkbox markers. The fallback renders the table manually (not via
    // ReactMarkdown), so this proves the synthesis + write-back were wired into
    // that path too (finding arb-large-doc-table-checkbox-doc-gap-1).
    function buildCheckboxFallbackTable() {
      const rows = ["# Tasks", "", "| Done | Name |", "| --- | --- |"];
      for (let index = 0; index < 1_100; index += 1) {
        const state = index === 0 ? "[ ]" : index === 1 ? "[x]" : "[ ]";
        rows.push(`| - ${state} | item-${index} |`);
      }
      return rows.join("\n");
    }

    const observed: string[] = [];
    function Harness() {
      const [markdown, setMarkdown] = useState(buildCheckboxFallbackTable());
      return (
        <PreviewPanel
          entry={createEntry({
            format: "md",
            name: "tasks.md",
            markdown,
            editedMarkdown: markdown,
          })}
          onMarkdownChange={(next) => {
            observed.push(next);
            setMarkdown(next);
          }}
        />
      );
    }

    render(<Harness />);

    // Fallback path is active.
    expect(screen.getByText("Large report")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    // No literal "- [ ]" text leaks into the cells for the first row.
    expect(screen.queryByText("- [ ]")).not.toBeInTheDocument();
    expect(checkboxes.length).toBeGreaterThan(1);

    // Row 0 is unchecked, row 1 is checked — synthesis reflects source state.
    const firstUnchecked = checkboxes.find((box) => !(box as HTMLInputElement).checked);
    const firstChecked = checkboxes.find((box) => (box as HTMLInputElement).checked);
    expect(firstUnchecked).toBeDefined();
    expect(firstChecked).toBeDefined();
    expect(firstUnchecked).toBeEnabled();

    // Toggling row 0 writes `[x]` back to the exact source marker, leaving the
    // label and the rest of the document intact.
    fireEvent.click(firstUnchecked as HTMLInputElement);
    await waitFor(() => {
      expect(observed.length).toBeGreaterThan(0);
    });
    const next = observed[observed.length - 1];
    // Byte-for-byte: only row 0's marker flipped to `[x]`; the label and every
    // other line are untouched.
    expect(next).toContain("| - [x] | item-0 |");
    expect(next).toContain("| - [x] | item-1 |");
    expect(next).toContain("| - [ ] | item-2 |");
    expect(next).toContain("# Tasks");
  });

  it("leaves escaped brackets literal in the large-document fallback path", async () => {
    // Escaped `\[ \]` must stay literal end-to-end, even in the fallback path.
    function buildEscapedFallbackTable() {
      const rows = ["# Tasks", "", "| Done | Name |", "| --- | --- |"];
      for (let index = 0; index < 1_100; index += 1) {
        const state = index === 0 ? "\\[ \\]" : "- [ ]";
        rows.push(`| ${state} | item-${index} |`);
      }
      return rows.join("\n");
    }

    render(
      <PreviewPanel
        entry={createEntry({
          format: "md",
          name: "tasks.md",
          markdown: buildEscapedFallbackTable(),
        })}
      />,
    );

    expect(screen.getByText("Large report")).toBeInTheDocument();
    // The escaped row 0 renders its bracket text, not a checkbox.
    expect(screen.getByText("[ ]")).toBeInTheDocument();
    // Real markers on later rows still synthesize checkboxes.
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });

  it("does not render toggle when entry is null", () => {
    render(<PreviewPanel entry={null} />);

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("shows the start-writing action in the empty state when provided", () => {
    const onStartWriting = vi.fn();

    render(<PreviewPanel entry={null} onStartWriting={onStartWriting} />);

    expect(
      screen.queryByRole("button", { name: "New document" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));

    expect(onStartWriting).toHaveBeenCalledTimes(1);
  });

  it("renders a populated toolbar New button when a handler is provided", () => {
    const onNewDocument = vi.fn();

    render(<PreviewPanel entry={createEntry()} onNewDocument={onNewDocument} />);

    fireEvent.click(screen.getByRole("button", { name: "New document" }));

    expect(onNewDocument).toHaveBeenCalledTimes(1);
  });

  it("does not render toggle when entry is pending", () => {
    render(<PreviewPanel entry={createEntry({ status: "pending" })} />);

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("does not render toggle when entry is converting", () => {
    render(<PreviewPanel entry={createEntry({ status: "converting" })} />);

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("does not render toggle when entry is error", () => {
    render(
      <PreviewPanel
        entry={createEntry({ status: "error", warnings: ["Failed"] })}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
  });

  it("shows the quality indicator when an entry includes quality metadata", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "pdf",
          quality: REVIEW_QUALITY,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "PDF quality: Review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("uses the entry format in the quality indicator label", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "json",
          quality: {
            level: "poor",
            summary:
              "Poor: JSON validation failed. Markdown was created from the unformatted source.",
          },
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "JSON quality: Poor" }),
    ).toBeInTheDocument();
  });

  it("shows the poor-quality indicator in the PDF error path", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "pdf",
          status: "error",
          warnings: ["This PDF may be scanned."],
          quality: {
            level: "poor",
            summary:
              "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
          },
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "PDF quality: Poor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This PDF may be scanned.")).toBeInTheDocument();
  });

  it("starts in preview mode showing rendered markdown", () => {
    render(<PreviewPanel entry={createEntry()} />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("switches to edit mode showing textarea with markdown content", () => {
    render(<PreviewPanel entry={createEntry()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const textarea = screen.getByRole("textbox", { name: "Edit markdown" });

    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("# Hello World");
  });

  it("switches back to preview mode from edit mode", () => {
    render(<PreviewPanel entry={createEntry()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders a linkedin plain-text view for supported markdown", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "# Hello World\n\n- First item\n- Second item",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));

    expect(screen.getByLabelText("LinkedIn preview")).toHaveTextContent(
      "Hello World",
    );
    expect(screen.getByLabelText("LinkedIn preview")).toHaveTextContent(
      "• First item",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("styles linkedin emphasis runs without changing preview text", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "**Bold** and *italic* and ~~struck~~",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));

    expect(screen.getByText("𝐁𝐨𝐥𝐝")).toHaveClass("linkedin-emphasis-bold");
    expect(screen.getByText("𝑖𝑡𝑎𝑙𝑖𝑐")).toHaveClass("linkedin-emphasis-italic");
    expect(screen.getByText("s̶t̶r̶u̶c̶k̶")).toHaveClass("linkedin-emphasis-strike");
    expect(screen.getByLabelText("LinkedIn preview")).toHaveTextContent(
      "𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐 and s̶t̶r̶u̶c̶k̶",
    );
  });

  it("renders GFM task list markers as interactive checkboxes", () => {
    const { container } = render(
      <PreviewPanel
        entry={createEntry({
          markdown: "- [x] Ship fix\n- [ ] Write docs",
        })}
        onMarkdownChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".markdown-surface ul.contains-task-list"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".markdown-surface li.task-list-item")).toHaveLength(
      2,
    );

    const surface = container.querySelector(".markdown-surface")!;
    expect(surface).not.toHaveTextContent("[x]");
    expect(surface).not.toHaveTextContent("[ ]");
    expect(surface.querySelectorAll("li:not(.task-list-item)")).toHaveLength(0);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "Toggle task: Ship fix" })).toBe(
      checkboxes[0],
    );
    expect(
      screen.getByRole("checkbox", { name: "Toggle task: Write docs" }),
    ).toBe(checkboxes[1]);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[0]).toBeEnabled();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[1]).toBeEnabled();
    expect(screen.getByText("Ship fix")).toBeInTheDocument();
    expect(screen.getByText("Write docs")).toBeInTheDocument();
  });

  it("toggles a rendered task checkbox through onMarkdownChange", () => {
    const onChange = vi.fn();
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "- [x] Ship fix\n- [ ] Write docs",
        })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle task: Write docs" }));

    expect(onChange).toHaveBeenCalledWith("- [x] Ship fix\n- [x] Write docs");
  });

  it("toggles ordered task checkboxes through onMarkdownChange", () => {
    const onChange = vi.fn();
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: [
            "1) [ ] First task",
            "2) [x] Second task",
            "3) [ ] Third task",
            "4) [ ] Fourth task",
          ].join("\n"),
        })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle task: First task" }));
    expect(onChange).toHaveBeenLastCalledWith(
      [
        "1) [x] First task",
        "2) [x] Second task",
        "3) [ ] Third task",
        "4) [ ] Fourth task",
      ].join("\n"),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle task: Second task" }));
    expect(onChange).toHaveBeenLastCalledWith(
      [
        "1) [ ] First task",
        "2) [ ] Second task",
        "3) [ ] Third task",
        "4) [ ] Fourth task",
      ].join("\n"),
    );
  });

  it("toggles exact task marker variants without changing neighboring lines", () => {
    const onChange = vi.fn();
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: [
            "- [ ] Top task",
            "  - [x] Nested task",
            "- [X] Uppercase checked",
            "Plain paragraph",
          ].join("\n"),
        })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(onChange).toHaveBeenLastCalledWith(
      [
        "- [ ] Top task",
        "  - [ ] Nested task",
        "- [X] Uppercase checked",
        "Plain paragraph",
      ].join("\n"),
    );

    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    expect(onChange).toHaveBeenLastCalledWith(
      [
        "- [ ] Top task",
        "  - [x] Nested task",
        "- [ ] Uppercase checked",
        "Plain paragraph",
      ].join("\n"),
    );
  });

  it("toggles the correct task after preview formatting shifts rendered line numbers", () => {
    const onChange = vi.fn();
    const markdown = [
      "Contact",
      "Location: Denver, CO",
      "Email: team@example.com",
      "LinkedIn: https://example.com/company",
      "",
      "- [ ] Task after formatted contact block",
    ].join("\n");

    render(
      <PreviewPanel
        entry={createEntry({ markdown })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(
      [
        "Contact",
        "Location: Denver, CO",
        "Email: team@example.com",
        "LinkedIn: https://example.com/company",
        "",
        "- [x] Task after formatted contact block",
      ].join("\n"),
    );
  });

  it("renders table-cell markers as real checkboxes and toggles the source through onMarkdownChange", () => {
    const onChange = vi.fn();
    const markdown = [
      "| MARKED | Name |",
      "| --- | --- |",
      "| - [ ] | Kjell Hedstrom |",
      "| - [x] | Jane Doe |",
    ].join("\n");

    const { container } = render(
      <PreviewPanel
        entry={createEntry({ markdown, editedMarkdown: markdown })}
        onMarkdownChange={onChange}
      />,
    );

    // Real checkboxes inside the table, interactive in Preview, no literal text.
    const cellCheckboxes = container.querySelectorAll<HTMLInputElement>(
      ".markdown-surface td input[type=\"checkbox\"]",
    );
    expect(cellCheckboxes).toHaveLength(2);
    expect(cellCheckboxes[0]).not.toBeChecked();
    expect(cellCheckboxes[0]).toBeEnabled();
    expect(cellCheckboxes[1]).toBeChecked();
    const surface = container.querySelector(".markdown-surface")!;
    expect(surface).not.toHaveTextContent("[ ]");
    expect(surface).not.toHaveTextContent("[x]");

    // Toggling the first cell checkbox flips exactly that source marker.
    fireEvent.click(cellCheckboxes[0]);
    expect(onChange).toHaveBeenCalledWith(
      [
        "| MARKED | Name |",
        "| --- | --- |",
        "| - [x] | Kjell Hedstrom |",
        "| - [x] | Jane Doe |",
      ].join("\n"),
    );
  });

  it("toggles independent table checkboxes in one row without disturbing the others", () => {
    const onChange = vi.fn();
    const markdown = [
      "| A | B | C |",
      "| --- | --- | --- |",
      "| - [ ] | - [x] | - [ ] |",
    ].join("\n");

    const { container } = render(
      <PreviewPanel
        entry={createEntry({ markdown, editedMarkdown: markdown })}
        onMarkdownChange={onChange}
      />,
    );

    const cellCheckboxes = container.querySelectorAll<HTMLInputElement>(
      ".markdown-surface td input[type=\"checkbox\"]",
    );
    expect(cellCheckboxes).toHaveLength(3);

    // Toggle the middle checkbox off -> only the middle marker changes.
    fireEvent.click(cellCheckboxes[1]);
    expect(onChange).toHaveBeenLastCalledWith(
      [
        "| A | B | C |",
        "| --- | --- | --- |",
        "| - [ ] | - [ ] | - [ ] |",
      ].join("\n"),
    );
  });

  it("resolves the correct original source line for a table after preview formatting collapses spacing", () => {
    const onChange = vi.fn();
    const markdown = [
      "Contact",
      "Location: Denver, CO",
      "Email: team@example.com",
      "",
      "| MARKED | Name |",
      "| --- | --- |",
      "| - [ ] | Kjell Hedstrom |",
    ].join("\n");

    const { container } = render(
      <PreviewPanel
        entry={createEntry({ markdown, editedMarkdown: markdown })}
        onMarkdownChange={onChange}
      />,
    );

    const checkbox = container.querySelector<HTMLInputElement>(
      ".markdown-surface td input[type=\"checkbox\"]",
    )!;
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(
      [
        "Contact",
        "Location: Denver, CO",
        "Email: team@example.com",
        "",
        "| MARKED | Name |",
        "| --- | --- |",
        "| - [x] | Kjell Hedstrom |",
      ].join("\n"),
    );
  });

  it("leaves an escaped table-cell marker literal with no checkbox", () => {
    const markdown = [
      "| MARKED | Name |",
      "| --- | --- |",
      "| \\[ \\] | Kjell Hedstrom |",
    ].join("\n");

    const { container } = render(
      <PreviewPanel
        entry={createEntry({ markdown, editedMarkdown: markdown })}
        onMarkdownChange={vi.fn()}
      />,
    );

    expect(
      container.querySelectorAll(".markdown-surface td input[type=\"checkbox\"]"),
    ).toHaveLength(0);
    expect(container.querySelector(".markdown-surface")).toHaveTextContent("[ ]");
  });

  it("renders nested GFM task lists as nested checkbox list items", () => {
    const { container } = render(
      <PreviewPanel
        entry={createEntry({
          markdown: [
            "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
            "",
            "  - [ ] ONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions",
            "- [ ] ONF-7952 Q1-4c Whitelabel Client Portal",
          ].join("\n"),
        })}
      />,
    );

    const topLevelList = container.querySelector(
      ".markdown-surface > ul.contains-task-list",
    );
    expect(topLevelList).toBeInTheDocument();
    expect(
      topLevelList?.querySelectorAll(":scope > li.task-list-item"),
    ).toHaveLength(2);

    const firstTopLevelItem = topLevelList?.querySelector(
      ":scope > li.task-list-item",
    );
    const nestedList = firstTopLevelItem?.querySelector(
      ":scope > ul.contains-task-list",
    );
    expect(nestedList).toBeInTheDocument();
    expect(
      nestedList?.querySelectorAll(":scope > li.task-list-item"),
    ).toHaveLength(1);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("stamps nested task checkboxes with their own source lines", () => {
    render(
      <ControlledPreviewPanel
        initialMarkdown={[
          "- [ ] Parent task",
          "",
          "  - [ ] Child task",
        ].join("\n")}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle task: Parent task" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Toggle task: Child task" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox", { name: "Edit markdown" })).toHaveValue(
      ["- [x] Parent task", "", "  - [x] Child task"].join("\n"),
    );
  });

  it("copies the rendered preview as html and plain text in preview mode", async () => {
    const { container } = render(<PreviewPanel entry={createEntry()} />);
    const previewSurface = container.querySelector(".markdown-surface");

    expect(previewSurface).not.toBeNull();
    Object.defineProperty(previewSurface!, "innerText", {
      configurable: true,
      value: "Hello World",
    });
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: MockBlob,
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy formatted text" }));

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledTimes(1);
    });

    const [items] = clipboardWrite.mock.calls[0] as [MockClipboardItem[]];
    const clipboardItem = items[0];
    const htmlBlob = await clipboardItem.getType("text/html");
    const plainBlob = await clipboardItem.getType("text/plain");

    expect(clipboardItem.types).toEqual(["text/html", "text/plain"]);
    await expect(htmlBlob.text()).resolves.toContain("Hello World</h1>");
    await expect(plainBlob.text()).resolves.toBe("Hello World");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("falls back to writeText with rendered plain text when rich clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    const { container } = render(<PreviewPanel entry={createEntry()} />);
    const previewSurface = container.querySelector(".markdown-surface");

    expect(previewSurface).not.toBeNull();
    Object.defineProperty(previewSurface!, "innerText", {
      configurable: true,
      value: "Hello World",
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy formatted text" }));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("Hello World");
    });

    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("falls back to execCommand when both clipboard.write and writeText are unavailable", async () => {
    const execCommand = vi.fn(() => true);
    const appendChildSpy = vi.spyOn(document.body, "appendChild");

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });

    const { container } = render(<PreviewPanel entry={createEntry()} />);
    const previewSurface = container.querySelector(".markdown-surface");

    expect(previewSurface).not.toBeNull();
    Object.defineProperty(previewSurface!, "innerText", {
      configurable: true,
      value: "Hello World",
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy formatted text" }));

    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith("copy");
    });

    const appendedTextarea = appendChildSpy.mock.calls.find(
      ([element]) => element instanceof HTMLTextAreaElement,
    )?.[0] as HTMLTextAreaElement | undefined;

    expect(appendedTextarea?.value).toBe("Hello World");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("copies the linkedin output in linkedin mode and resets the status label", async () => {
    vi.useFakeTimers();

    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "# Hello World\n\n- First item",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy LinkedIn text" }));
      await Promise.resolve();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(
      "Hello World\n═══════════\n\n• First item",
    );
    expect(screen.getByText("Copied")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("uses mode-specific copy button labels", () => {
    render(<PreviewPanel entry={createEntry()} />);

    expect(
      screen.getByRole("button", { name: "Copy formatted text" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    expect(
      screen.getByRole("button", { name: "Copy LinkedIn text" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("button", { name: "Copy markdown document" }),
    ).toBeInTheDocument();
  });

  it("refuses the linkedin view for markdown tables", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "| Name | Role |\n| --- | --- |\n| Anna | Admin |",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));

    expect(
      screen.getByText("LinkedIn view is unavailable for Markdown tables."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Remove tables or HTML from this draft to preview a LinkedIn-ready plain-text version.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy LinkedIn text" }),
    ).not.toBeInTheDocument();
  });

  it("preserves edited markdown across preview, linkedin, and edit modes", () => {
    render(
      <PreviewPanel
        entry={createEntry({ editedMarkdown: "# Edited\n\n- Item" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    expect(screen.getByLabelText("LinkedIn preview")).toHaveTextContent(
      "Edited",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Edit markdown" })).toHaveValue(
      "# Edited\n\n- Item",
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("uses an updated view-mode aria label for the three-button toggle", () => {
    render(<PreviewPanel entry={createEntry()} />);

    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
  });

  it("calls onMarkdownChange when textarea content changes", () => {
    const onChange = vi.fn();

    render(<PreviewPanel entry={createEntry()} onMarkdownChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "# Hello World!" },
    });

    expect(onChange).toHaveBeenCalledWith("# Hello World!");
  });

  it("replaces selection with converted paste and restores caret after insert", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });

    render(<ControlledPreviewPanel initialMarkdown="Alpha target Omega" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;

    editor.setSelectionRange(6, 12);
    fireEditorPaste(editor, { plainText: "𝐁𝐨𝐥𝐝" });

    expect(editor).toHaveValue("Alpha **Bold** Omega");

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(editor.selectionStart).toBe(14);
    expect(editor.selectionEnd).toBe(14);
  });

  it("shows paste conversion status while html paste conversion is queued", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });

    render(<ControlledPreviewPanel initialMarkdown="" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    });

    fireEditorPaste(editor, { html: "<p>𝐁𝐨𝐥𝐝</p>", plainText: "Bold" });

    expect(screen.getByRole("status")).toHaveTextContent("Converting paste...");
    expect(editor).toHaveAttribute("aria-busy", "true");
    expect(editor).toHaveAttribute("readonly");

    await waitFor(() => expect(editor).toHaveValue("**Bold**"));
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(editor).not.toHaveAttribute("aria-busy", "true");
    expect(editor).not.toHaveAttribute("readonly");
  });

  it("allows the queued html paste commit to update markdown", async () => {
    const execCommand = vi.fn((_command: string, _showUi: boolean, text: string) => {
      const editor = document.activeElement as HTMLTextAreaElement | null;
      if (!editor) return false;

      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const nextValue = editor.value.slice(0, start) + text + editor.value.slice(end);
      editor.value = nextValue;
      editor.setSelectionRange(start + text.length, start + text.length);
      fireEvent.input(editor, { target: { value: nextValue } });
      return true;
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    render(<ControlledPreviewPanel initialMarkdown="" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    });

    fireEditorPaste(editor, { html: "<p>𝐁𝐨𝐥𝐝</p>", plainText: "Bold" });

    await waitFor(() => expect(editor).toHaveValue("**Bold**"));
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "**Bold**");
    expect(editor).not.toHaveAttribute("readonly");
  });

  it("defers large unchanged plain-text paste notification until after native paste", async () => {
    const onLargeMarkdownPaste = vi.fn();

    render(
      <PreviewPanel
        entry={createEntry()}
        onLargeMarkdownPaste={onLargeMarkdownPaste}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEditorPaste(screen.getByRole("textbox", { name: "Edit markdown" }), {
      plainText: "x".repeat(201),
    });

    expect(onLargeMarkdownPaste).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onLargeMarkdownPaste).toHaveBeenCalledWith("x".repeat(201)),
    );
  });

  it("does not notify when converted paste is at or below threshold", () => {
    const onLargeMarkdownPaste = vi.fn();

    render(
      <PreviewPanel
        entry={createEntry()}
        onLargeMarkdownPaste={onLargeMarkdownPaste}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEditorPaste(screen.getByRole("textbox", { name: "Edit markdown" }), {
      plainText: "x".repeat(200),
    });

    expect(onLargeMarkdownPaste).not.toHaveBeenCalled();
  });

  it("displays editedMarkdown when present in preview mode", () => {
    render(
      <PreviewPanel entry={createEntry({ editedMarkdown: "# Edited" })} />,
    );

    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("displays editedMarkdown in textarea when in edit mode", () => {
    render(
      <PreviewPanel entry={createEntry({ editedMarkdown: "# Edited" })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox")).toHaveValue("# Edited");
  });

  it("keeps the original markdown untouched in edit mode", () => {
    const markdown = [
      "Contact",
      "Location: Chihuahua, Mexico",
      "Email: javier@example.com",
    ].join("\n");

    render(<PreviewPanel entry={createEntry({ markdown })} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("textbox")).toHaveValue(markdown);
  });

  it("opens scratch entries directly in edit mode even with empty markdown", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          name: "Untitled.md",
          format: "md",
          markdown: "",
          editedMarkdown: "",
          isScratch: true,
        })}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "Edit markdown" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("focuses the editor when the editor focus request id increments", async () => {
    const { rerender } = render(
      <PreviewPanel
        entry={createEntry()}
        editorFocusRequest={{ id: 0, target: "editor" }}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Edit markdown" })).toBeNull();

    rerender(
      <PreviewPanel
        entry={createEntry()}
        editorFocusRequest={{ id: 1, target: "editor" }}
      />,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit markdown",
    });
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("opens find from the visible control and highlights the active preview match", async () => {
    const { container } = render(
      <PreviewPanel
        entry={createEntry({
          markdown: "Alpha\nBeta\nAlpha",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));

    expect(
      screen.queryByRole("textbox", { name: "Edit markdown" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Match Case is on by default; query uses the document's casing.
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "Alpha" },
      },
    );

    await screen.findByText("1 of 2");
    const highlight = container.querySelector(".markdown-rendered-find-highlight");
    expect(highlight).toHaveTextContent("Alpha");
    expect(highlight?.closest(".markdown-surface")).toBeInTheDocument();
  });

  it("highlights editor matches when find is opened from edit mode", () => {
    const { container } = render(
      <PreviewPanel
        entry={createEntry({
          markdown: "Alpha\nBeta\nAlpha",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "Alpha" },
      },
    );

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    const highlight = container.querySelector(".markdown-find-highlight");
    expect(highlight).toHaveTextContent("Alpha");
    expect(highlight?.closest(".markdown-find-overlay")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("keeps the editor find highlight overlay aligned with the active match", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 100,
    });

    try {
      const { container } = render(
        <PreviewPanel
          entry={createEntry({
            markdown: Array.from({ length: 80 }, (_, index) => `Line ${index}`).join(
              "\n",
            ),
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Find markdown text" }),
        {
          target: { value: "Line 40" },
        },
      );

      await screen.findByText("1 of 1");

      const editor = screen.getByRole("textbox", { name: "Edit markdown" });
      const overlay = container.querySelector(
        ".markdown-find-overlay",
      ) as HTMLElement;
      const highlight = container.querySelector(".markdown-find-highlight");

      expect(highlight).toHaveTextContent("Line 40");
      // After the fix, the scroll position comes from the measured-mirror
      // helper (`scrollTextareaToLine`), which requires real DOM geometry.
      // jsdom returns zero-rects, so we cannot assert a specific scrollTop
      // here — that coverage moved to the Playwright spec
      // tests/e2e/find-match-scroll.spec.ts which runs against real Chromium
      // layout. What this unit test still proves is the invariant the bug
      // report cared about: the find-overlay <pre> tracks the textarea's
      // scrollTop so the highlight stays aligned with the underlying text.
      await waitFor(() => expect(overlay.scrollTop).toBe(editor.scrollTop));
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor,
        );
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          clientHeightDescriptor,
        );
      }
    }
  });

  it("captures preview anchor and applies it to the editor on preview->edit", () => {
    const topLineFromRendered = vi
      .spyOn(viewportAnchor, "topLineFromRendered")
      .mockReturnValue(42);
    const scrollTextareaToLine = vi
      .spyOn(viewportAnchor, "scrollTextareaToLine")
      .mockImplementation(() => undefined);
    const topLineFromTextareaMirror = vi.spyOn(
      viewportAnchor,
      "topLineFromTextareaMirror",
    );

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            markdown: Array.from(
              { length: 80 },
              (_, index) => `Line ${index}`,
            ).join("\n"),
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      expect(topLineFromRendered).toHaveBeenCalledTimes(1);
      expect(topLineFromTextareaMirror).not.toHaveBeenCalled();
      expect(scrollTextareaToLine).toHaveBeenCalledTimes(1);

      const args = scrollTextareaToLine.mock.calls[0];
      expect(args[3]).toBe(42);
    } finally {
      topLineFromRendered.mockRestore();
      scrollTextareaToLine.mockRestore();
      topLineFromTextareaMirror.mockRestore();
    }
  });

  it("captures editor anchor and applies it to the preview surface on edit->preview", () => {
    const topLineFromTextareaMirror = vi
      .spyOn(viewportAnchor, "topLineFromTextareaMirror")
      .mockReturnValue(17);
    const scrollRenderedToLine = vi
      .spyOn(viewportAnchor, "scrollRenderedToLine")
      .mockImplementation(() => undefined);

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            markdown: Array.from(
              { length: 80 },
              (_, index) => `Line ${index}`,
            ).join("\n"),
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "View" }));

      // First call captures preview-mode (covered above). Editor capture
      // happens on the edit→preview switch.
      expect(topLineFromTextareaMirror).toHaveBeenCalledTimes(1);
      expect(scrollRenderedToLine).toHaveBeenCalled();

      const lastCall =
        scrollRenderedToLine.mock.calls[scrollRenderedToLine.mock.calls.length - 1];
      expect(lastCall[1]).toBe(17);
    } finally {
      topLineFromTextareaMirror.mockRestore();
      scrollRenderedToLine.mockRestore();
    }
  });

  it("captures editor anchor and applies it to the LinkedIn surface on edit->linkedin", () => {
    const topLineFromTextareaMirror = vi
      .spyOn(viewportAnchor, "topLineFromTextareaMirror")
      .mockReturnValue(9);
    const scrollRenderedToLine = vi
      .spyOn(viewportAnchor, "scrollRenderedToLine")
      .mockImplementation(() => undefined);

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            markdown: "# Hello World\n\n- First item\n- Second item",
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));

      expect(topLineFromTextareaMirror).toHaveBeenCalledTimes(1);
      expect(scrollRenderedToLine).toHaveBeenCalled();

      const lastCall =
        scrollRenderedToLine.mock.calls[scrollRenderedToLine.mock.calls.length - 1];
      expect(lastCall[1]).toBe(9);
    } finally {
      topLineFromTextareaMirror.mockRestore();
      scrollRenderedToLine.mockRestore();
    }
  });

  it("still calls anchor helpers when a find match is active during a mode switch", async () => {
    const topLineFromRendered = vi
      .spyOn(viewportAnchor, "topLineFromRendered")
      .mockReturnValue(3);
    const scrollTextareaToLine = vi
      .spyOn(viewportAnchor, "scrollTextareaToLine")
      .mockImplementation(() => undefined);

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            markdown: "Alpha\nBeta\nGamma",
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Find markdown text" }),
        {
          target: { value: "Beta" },
        },
      );

      await screen.findByText("1 of 1");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      expect(topLineFromRendered).toHaveBeenCalled();
      expect(scrollTextareaToLine).toHaveBeenCalled();
      const lastCall =
        scrollTextareaToLine.mock.calls[scrollTextareaToLine.mock.calls.length - 1];
      expect(lastCall[3]).toBe(3);
    } finally {
      topLineFromRendered.mockRestore();
      scrollTextareaToLine.mockRestore();
    }
  });

  it("renders preview blocks with data-source-line attributes", () => {
    const { container } = render(
      <PreviewPanel
        entry={createEntry({
          markdown: "# Title\n\nParagraph",
        })}
      />,
    );

    expect(
      container.querySelector('[data-source-line="1"]'),
    ).not.toBeNull();
  });

  it("keeps preview highlighting visible when navigating rendered matches", async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Element.prototype.getBoundingClientRect = function () {
      if (this instanceof Element && this.classList.contains("markdown-surface")) {
        return {
          x: 0,
          y: 100,
          width: 100,
          height: 100,
          top: 100,
          right: 100,
          bottom: 200,
          left: 0,
          toJSON: () => ({}),
        };
      }

      if (
        this instanceof Element &&
        this.classList.contains("markdown-rendered-find-highlight")
      ) {
        return {
          x: 0,
          y: 260,
          width: 80,
          height: 20,
          top: 260,
          right: 80,
          bottom: 280,
          left: 0,
          toJSON: () => ({}),
        };
      }

      return getBoundingClientRect.call(this);
    };

    try {
      const { container } = render(
        <PreviewPanel
          entry={createEntry({
            markdown: "**Beta** Gamma\n\n**Beta** Gamma",
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
      fireEvent.change(
        screen.getByRole("textbox", { name: "Find markdown text" }),
        {
          target: { value: "Beta Gamma" },
        },
      );

      await screen.findByText("1 of 2");
      const previewSurface = container.querySelector(
        ".markdown-surface",
      ) as HTMLElement;
      // The fix routes find highlighting through a rehype plugin that
      // owns the <mark> in the React tree. For cross-emphasis matches
      // ("Beta Gamma" spans `<strong>Beta</strong> Gamma`), the plugin
      // splits the wrap into two <mark> elements — one inside the
      // strong, one in the trailing plain text. This is correct: it
      // preserves the original DOM structure (no <strong> duplication,
      // which was the Bug 2 root cause), and the rendered characters
      // are unchanged.
      const firstMarks = Array.from(
        container.querySelectorAll(".markdown-rendered-find-highlight"),
      );
      expect(firstMarks.length).toBeGreaterThanOrEqual(1);
      expect(firstMarks.map((m) => m.textContent ?? "").join("")).toBe(
        "Beta Gamma",
      );
      // Centering uses the FIRST <mark>; with the stubbed
      // getBoundingClientRect both marks report y=260, so scrollTop
      // remains the same magic value as before (mark.top - surface.top
      // - (clientHeight - height) / 2 = 260 - 100 - 40 = 120).
      expect(previewSurface.scrollTop).toBe(120);

      fireEvent.click(screen.getByRole("button", { name: "Next match" }));

      await screen.findByText("2 of 2");
      const secondMarks = Array.from(
        container.querySelectorAll(".markdown-rendered-find-highlight"),
      );
      expect(secondMarks.length).toBeGreaterThanOrEqual(1);
      expect(secondMarks.map((m) => m.textContent ?? "").join("")).toBe(
        "Beta Gamma",
      );
      // <strong> count is preserved (this is the bug 2 invariant) — the
      // fixture has two **Beta** spans; after find navigation there
      // must still be exactly two.
      expect(container.querySelectorAll(".markdown-surface strong")).toHaveLength(2);
    } finally {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
      if (scrollHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollHeight",
          scrollHeightDescriptor,
        );
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          clientHeightDescriptor,
        );
      }
    }
  });

  it("re-resolves anchor at apply time so a resize between switches still lands on the same source line", () => {
    const topLineFromTextareaMirror = vi
      .spyOn(viewportAnchor, "topLineFromTextareaMirror")
      .mockReturnValue(50);
    const scrollRenderedToLine = vi.spyOn(
      viewportAnchor,
      "scrollRenderedToLine",
    );

    // The destination container's actual layout may shift between capture
    // and apply (e.g. window resize) — the anchor is a line, so the apply
    // call still passes the captured source-line through unchanged.
    scrollRenderedToLine.mockImplementation(() => undefined);

    try {
      render(
        <PreviewPanel
          entry={createEntry({
            markdown: Array.from(
              { length: 80 },
              (_, index) => `Line ${index}`,
            ).join("\n"),
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "View" }));

      expect(topLineFromTextareaMirror).toHaveBeenCalledTimes(1);
      const callArgs =
        scrollRenderedToLine.mock.calls[scrollRenderedToLine.mock.calls.length - 1];
      expect(callArgs[1]).toBe(50);
    } finally {
      topLineFromTextareaMirror.mockRestore();
      scrollRenderedToLine.mockRestore();
    }
  });

  it("opens find with Cmd+F without leaving preview mode", async () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha" })} />);

    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Find markdown text" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "View" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it.each([
    ["no entry", null],
    ["pending entry", createEntry({ status: "pending" })],
    [
      "error entry",
      createEntry({ status: "error", warnings: ["Conversion failed."] }),
    ],
  ] as const)(
    "does not intercept find shortcuts for %s",
    (_label, entry) => {
      render(<PreviewPanel entry={entry} />);

      const event = new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(
        screen.queryByRole("textbox", { name: "Find markdown text" }),
      ).not.toBeInTheDocument();
    },
  );

  it("does not intercept Cmd+Option+F", () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(
      screen.queryByRole("textbox", { name: "Replacement text" }),
    ).not.toBeInTheDocument();
  });

  it("refocuses an already-open find UI from keyboard shortcuts", async () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha Beta" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    const findInput = screen.getByRole("textbox", {
      name: "Find markdown text",
    });
    const editor = screen.getByRole("textbox", { name: "Edit markdown" });

    editor.focus();
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    await waitFor(() => expect(document.activeElement).toBe(findInput));

    editor.focus();
    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    await waitFor(() => expect(document.activeElement).toBe(findInput));
    expect(
      screen.getByRole("textbox", { name: "Replacement text" }),
    ).toBeInTheDocument();
  });

  it("does not intercept Ctrl+H outside the find bar", () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha" })} />);

    const event = new KeyboardEvent("keydown", {
      key: "h",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(
      screen.queryByRole("textbox", { name: "Replacement text" }),
    ).not.toBeInTheDocument();
  });

  it("keeps replace visible while plain Cmd+F refocuses find", async () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha Beta" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit markdown",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Find markdown text" }),
    );

    editor.focus();
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    const findInput = screen.getByRole("textbox", {
      name: "Find markdown text",
    });
    await waitFor(() => expect(document.activeElement).toBe(findInput));
    expect(
      screen.getByRole("textbox", { name: "Replacement text" }),
    ).toBeInTheDocument();
  });

  it("replace actions use the existing markdown change callback", () => {
    const onChange = vi.fn();

    render(
      <PreviewPanel
        entry={createEntry({ markdown: "Alpha beta Alpha" })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "Alpha" },
      },
    );
    // Replace is auto-expanded on Cmd-F in edit mode; no toggle click needed.
    fireEvent.change(screen.getByRole("textbox", { name: "Replacement text" }), {
      target: { value: "Gamma" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(onChange).toHaveBeenCalledWith("Gamma beta Alpha");

    fireEvent.click(screen.getByRole("button", { name: "Replace All" }));
    expect(onChange).toHaveBeenCalledWith("Gamma beta Gamma");
  });

  it("replace all updates every match beyond the navigation cap", () => {
    const onChange = vi.fn();

    render(
      <PreviewPanel
        entry={createEntry({ markdown: "a".repeat(12_000) })}
        onMarkdownChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "a" },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Replacement text" }), {
      target: { value: "b" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Replace All" }));

    expect(onChange).toHaveBeenCalledWith("b".repeat(12_000));
  });

  it("keeps find open while switching view modes", () => {
    render(<PreviewPanel entry={createEntry({ markdown: "Alpha" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    expect(screen.getByRole("search")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("search")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));

    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("keeps preview find offsets aligned after disabled repository links", async () => {
    const markdown = [
      "[Repository guide](../README.md)",
      "",
      "```xml",
      "<dict>",
      "  <key>RunAtLoad</key>",
      "  <true/>",
      "</dict>",
      "```",
    ].join("\n");
    const { container } = render(
      <PreviewPanel entry={createEntry({ markdown })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      { target: { value: "RunAtLoad" } },
    );

    await waitFor(() => {
      expect(screen.getByText("1 of 1")).toBeInTheDocument();
      expect(
        container.querySelector(
          ".markdown-surface mark.markdown-rendered-find-highlight",
        ),
      ).toHaveTextContent("RunAtLoad");
    });
  });

  it("zero-width preview matches do not leak the sentinel ZWSP into renderedViewText", async () => {
    // Reviewer-B regression: the rehype plugin inserts a U+200B sentinel
    // inside `<mark class="markdown-rendered-find-highlight-zero">` when
    // the active match is zero-width. To trigger the leak the snapshot
    // effect must RE-RUN while the ZWSP mark is in the DOM (deps are
    // mode / isFindOpen / effectiveMarkdown / linkedinPreview /
    // previewMarkdown). We force the re-snapshot by toggling mode
    // preview → edit → preview with the zero-width find still active.
    // If the U+200B leaks into renderedViewText, the next non-zero
    // search ("Hello") finds at offset 1 and the rehype plugin (walking
    // a fresh hast tree without the sentinel) wraps chars 1-6
    // ("ello ") instead of 0-5 ("Hello").
    render(
      <PreviewPanel
        entry={createEntry({
          markdown: "Hello world",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    fireEvent.click(screen.getByRole("button", { name: "Regex search" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      { target: { value: "^" } },
    );
    await screen.findByText(/1 of/);
    expect(
      document.querySelector(".markdown-rendered-find-highlight-zero"),
    ).not.toBeNull();

    // Force the snapshot effect to RE-RUN while the ZWSP mark is in
    // the DOM: switch to edit, then back to preview. The deps
    // (mode + isFindOpen) change on each switch.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    // After the second snapshot, renderedViewText reflects the current
    // surface (which still has the zero-width mark since find is open).
    await screen.findByText(/1 of/);

    // Disable regex; change query to non-zero literal "Hello".
    fireEvent.click(screen.getByRole("button", { name: "Regex search" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      { target: { value: "Hello" } },
    );
    await screen.findByText("1 of 1");

    // Load-bearing assertion: the rendered non-zero <mark> wraps
    // exactly "Hello". Without the scrub in PreviewPanel.tsx, this is
    // "ello " (off-by-one signature of a leaked ZWSP).
    const rendered = document.querySelector(
      ".markdown-surface mark.markdown-rendered-find-highlight:not(.markdown-rendered-find-highlight-zero)",
    );
    expect(rendered).not.toBeNull();
    expect(rendered?.textContent).toBe("Hello");
  });

  it("reports editor caret changes to the host keyed by document id", () => {
    const onEditorViewStateChange = vi.fn();
    render(
      <PreviewPanel
        entry={createEntry({ id: "doc-a", markdown: "# Hello World" })}
        onEditorViewStateChange={onEditorViewStateChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;

    textarea.setSelectionRange(7, 7);
    fireEvent.select(textarea);

    expect(onEditorViewStateChange).toHaveBeenCalledWith(
      "doc-a",
      expect.objectContaining({ selectionStart: 7, selectionEnd: 7 }),
    );
  });

  it("restores the remembered caret when returning to a document", () => {
    const MARKDOWN_A = "# Hello World";

    function Harness() {
      const store = useRef(new Map<string, EditorViewState>());
      const [entry, setEntry] = useState(() =>
        createEntry({ id: "doc-a", markdown: MARKDOWN_A }),
      );
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setEntry(createEntry({ id: "doc-b", markdown: "other doc" }))
            }
          >
            go-b
          </button>
          <button
            type="button"
            onClick={() =>
              setEntry(createEntry({ id: "doc-a", markdown: MARKDOWN_A }))
            }
          >
            go-a
          </button>
          <PreviewPanel
            entry={entry}
            getSavedEditorViewState={(id) => store.current.get(id)}
            onEditorViewStateChange={(id, state) =>
              store.current.set(id, state)
            }
          />
        </>
      );
    }

    render(<Harness />);

    // Place the caret mid-document in doc A and let it be reported/stored.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textareaA = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    textareaA.setSelectionRange(7, 7);
    fireEvent.select(textareaA);

    // Switch away to doc B, then back to doc A.
    fireEvent.click(screen.getByRole("button", { name: "go-b" }));
    fireEvent.click(screen.getByRole("button", { name: "go-a" }));

    // Re-entering edit mode on doc A restores the remembered caret.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const restored = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    expect(restored.selectionStart).toBe(7);
    expect(restored.selectionEnd).toBe(7);
  });
});

describe("PreviewPanel format download buttons", () => {
  it("renders Markdown and HTML download buttons beside Save", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onSave={vi.fn()}
        onDownloadMarkdown={vi.fn()}
        onExportHtml={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save document" });
    const markdownButton = screen.getByRole("button", {
      name: "Download Markdown",
    });
    const htmlButton = screen.getByRole("button", { name: "Download HTML" });
    expect(markdownButton).toBeInTheDocument();
    expect(htmlButton).toBeInTheDocument();
    expect(screen.getByText("MD")).toBeInTheDocument();
    expect(screen.getByText("HTML")).toBeInTheDocument();
    expect(screen.getByText("Download Markdown")).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(screen.getByText("Download HTML")).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(htmlButton).not.toHaveAttribute("title");
    // Placement: Save comes before the format downloads in DOM order.
    expect(
      saveButton.compareDocumentPosition(markdownButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not render format download buttons when no handlers are provided", () => {
    render(<PreviewPanel entry={createEntry()} onSave={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Download Markdown" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download HTML" }),
    ).not.toBeInTheDocument();
  });

  it("invokes the format download handlers on click", () => {
    const onDownloadMarkdown = vi.fn();
    const onExportHtml = vi.fn();
    render(
      <PreviewPanel
        entry={createEntry()}
        onDownloadMarkdown={onDownloadMarkdown}
        onExportHtml={onExportHtml}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Download HTML" }));
    expect(onDownloadMarkdown).toHaveBeenCalledTimes(1);
    expect(onExportHtml).toHaveBeenCalledTimes(1);
  });

  it("disables the HTML download button when exportHtmlDisabled is set", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onExportHtml={vi.fn()}
        exportHtmlDisabled
      />,
    );
    expect(screen.getByRole("button", { name: "Download HTML" })).toBeDisabled();
  });

  it("disables the Markdown download button when downloadMarkdownDisabled is set", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onDownloadMarkdown={vi.fn()}
        downloadMarkdownDisabled
      />,
    );
    expect(
      screen.getByRole("button", { name: "Download Markdown" }),
    ).toBeDisabled();
  });

  it("disables and marks busy while exporting", () => {
    render(
      <PreviewPanel
        entry={createEntry()}
        onExportHtml={vi.fn()}
        exportHtmlBusy
      />,
    );
    const button = screen.getByRole("button", { name: "Download HTML" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

// Coverage boundary notes (carried from plan review):
//  - The single-native-undo-step guarantee (⌘Z restores the pre-format text)
//    runs through commitTargetedInsert → execCommand("insertText"), which is
//    unavailable in jsdom. These component tests therefore exercise the
//    onMarkdownChange fallback path only — identical to how the existing
//    bold/italic/list/paste edit-command tests in this file assert. The real
//    undo path is validated by the manual Mac-app smoke test in the plan.
//  - A Playwright/desktop e2e for the click→format flow is intentionally
//    OUT OF SCOPE for this slice: it has parity with the existing edit-command
//    coverage (component + manual smoke, not e2e).
describe("PreviewPanel Adjust formatting toolbar action", () => {
  function mockExecCommandReturnsFalse() {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
  }

  // mockExecCommandReturnsFalse stubs the global document.execCommand via a
  // configurable property; delete it after each test so the stub never leaks
  // past this block and couples to later tests (jsdom ships no execCommand, so
  // delete restores the original absent state).
  afterEach(() => {
    delete (document as { execCommand?: unknown }).execCommand;
    vi.useRealTimers();
  });

  it("renders the Adjust formatting button only in edit mode when formatting is available", () => {
    render(<ControlledPreviewPanel initialMarkdown='{"a":1}' />);

    // Default preview mode: control absent.
    expect(
      screen.queryByRole("button", { name: "Adjust formatting" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    expect(
      screen.queryByRole("button", { name: "Adjust formatting" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const button = screen.getByRole("button", { name: "Adjust formatting" });
    expect(button).toBeInTheDocument();

    const buttonNames = screen.getAllByRole("button").map((element) => {
      const explicitName = element.getAttribute("aria-label");
      return explicitName ?? element.textContent?.trim();
    });
    expect(buttonNames.indexOf("Adjust formatting")).toBe(
      buttonNames.indexOf("LinkedIn") + 1,
    );
  });

  it("removes the new-formatting spotlight after 20 seconds", () => {
    vi.useFakeTimers();
    render(<ControlledPreviewPanel initialMarkdown='{"a":1}' />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const button = screen.getByRole("button", { name: "Adjust formatting" });
    expect(button).toHaveClass("is-newly-available");

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(button).not.toHaveClass("is-newly-available");
  });

  it("hides the button when the editor content is prose (AC4)", () => {
    render(<ControlledPreviewPanel initialMarkdown="# Hello World" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.queryByRole("button", { name: "Adjust formatting" }),
    ).not.toBeInTheDocument();
  });

  it("formats a whole-document one-line object into a fenced indented block (AC1)", () => {
    mockExecCommandReturnsFalse();
    render(
      <ControlledPreviewPanel initialMarkdown='{"name":"doc2md","active":true}' />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: "Adjust formatting" });
    expect(button).toBeEnabled();
    expect(button).toHaveClass("is-newly-available");

    fireEvent.click(button);

    expect(button).not.toHaveClass("is-newly-available");
    expect(editor).toHaveValue(
      '```json\n{\n  "name": "doc2md",\n  "active": true\n}\n```',
    );
  });

  it("shows the button after a native unchanged plain-text JSON paste into an empty editor", async () => {
    render(<ControlledPreviewPanel initialMarkdown="" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    expect(
      screen.queryByRole("button", { name: "Adjust formatting" }),
    ).not.toBeInTheDocument();

    const json = '{"dbBackend":"sqlite","activeAdapters":{"db":"sqlite"}}';
    fireEditorPaste(editor, { plainText: json });
    fireEvent.change(editor, {
      target: {
        value: json,
        selectionStart: json.length,
        selectionEnd: json.length,
      },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Adjust formatting" }),
      ).toBeEnabled();
    });
  });

  it("shows the button for pasted JSON with Markdown-escaped underscores", async () => {
    render(<ControlledPreviewPanel initialMarkdown="" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    const json = '{"build":{"commit\\_sha":"d514327"}}';

    fireEditorPaste(editor, { plainText: json });
    fireEvent.change(editor, {
      target: {
        value: json,
        selectionStart: json.length,
        selectionEnd: json.length,
      },
    });

    const button = await screen.findByRole("button", {
      name: "Adjust formatting",
    });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(editor).toHaveValue(
      '```json\n{\n  "build": {\n    "commit_sha": "d514327"\n  }\n}\n```',
    );
  });

  it("formats only the selected raw JSON snippet, leaving surrounding Markdown byte-identical (AC2)", () => {
    mockExecCommandReturnsFalse();
    const before = "Here is some config:\n\n";
    const json = '{"a":1,"b":2}';
    const after = "\n\nThanks.";
    render(
      <ControlledPreviewPanel initialMarkdown={before + json + after} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    editor.setSelectionRange(before.length, before.length + json.length);
    fireEvent.select(editor);

    const button = screen.getByRole("button", { name: "Adjust formatting" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(editor).toHaveValue(
      before + '{\n  "a": 1,\n  "b": 2\n}' + after,
    );
  });

  it("reformats a json fenced block while preserving the fence (AC3)", () => {
    mockExecCommandReturnsFalse();
    render(
      <ControlledPreviewPanel initialMarkdown={'```json\n{"a":1,"b":2}\n```'} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: "Adjust formatting" });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(editor).toHaveValue('```json\n{\n  "a": 1,\n  "b": 2\n}\n```');
  });

  it("does not rewrite malformed JSON and shows no success UI (AC4)", () => {
    mockExecCommandReturnsFalse();
    const onMarkdownChange = vi.fn();
    const malformed = '{"a":1,}';
    render(
      <PreviewPanel
        entry={createEntry({ markdown: malformed, editedMarkdown: malformed })}
        onMarkdownChange={onMarkdownChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const editor = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    // (a) Button is hidden, so the action cannot fire or show an unavailable
    // cursor over a non-action.
    expect(
      screen.queryByRole("button", { name: "Adjust formatting" }),
    ).not.toBeInTheDocument();

    const valueBefore = editor.value;

    // (a) No edit committed via the change/fallback path.
    expect(onMarkdownChange).not.toHaveBeenCalled();
    // (b) Textarea content byte-identical.
    expect(editor.value).toBe(valueBefore);
    // (c) No success/confirmation affordance exists (the design has none).
    expect(screen.queryByText(/formatted/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

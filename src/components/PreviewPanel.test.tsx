import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversionQuality } from "../converters/types";
import type { FileEntry } from "../types";
import PreviewPanel from "./PreviewPanel";

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

afterEach(() => {
  cleanup();
});

const originalClipboardItem = globalThis.ClipboardItem;
const originalBlob = globalThis.Blob;
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
});

describe("PreviewPanel", () => {
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
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LinkedIn" })).toHaveAttribute(
      "aria-describedby",
      "linkedin-toggle-tooltip",
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Unicode formatting for easy LinkedIn posting",
    );
  });

  it("renders toggle buttons when entry is warning with markdown", () => {
    render(
      <PreviewPanel
        entry={createEntry({ status: "warning", warnings: ["Some warning"] })}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));

    expect(onStartWriting).toHaveBeenCalledTimes(1);
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

  it("shows the PDF quality indicator when a PDF entry includes quality metadata", () => {
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

  it("does not show a PDF quality indicator for non-PDF entries", () => {
    render(
      <PreviewPanel
        entry={createEntry({
          format: "txt",
          quality: REVIEW_QUALITY,
        })}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /PDF quality:/ }),
    ).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

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
    await expect(htmlBlob.text()).resolves.toContain("<h1>Hello World</h1>");
    await expect(plainBlob.text()).resolves.toBe("Hello World");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("falls back to copying rendered plain text when rich clipboard support is unavailable", async () => {
    const execCommand = vi.fn(() => true);
    const appendChildSpy = vi.spyOn(document.body, "appendChild");

    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
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
      expect(execCommand).toHaveBeenCalledWith("copy");
    });

    const appendedTextarea = appendChildSpy.mock.calls.find(
      ([element]) => element instanceof HTMLTextAreaElement,
    )?.[0] as HTMLTextAreaElement | undefined;

    expect(appendedTextarea?.value).toBe("Hello World");
    expect(clipboardWriteText).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
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
});

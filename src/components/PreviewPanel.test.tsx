import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversionQuality } from "../converters/types";
import type { FileEntry } from "../types";
import PreviewPanel from "./PreviewPanel";

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

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types";
import FileListItem from "../FileListItem";

function createEntry(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "entry-1",
    file: new File(["# Test"], name, { type: "text/markdown" }),
    name,
    format: "md",
    status: "success",
    markdown: "# Test",
    warnings: [],
    selected: false,
    ...overrides,
  };
}

describe("FileListItem", () => {
  it("renders an instant custom tooltip with the full filename", () => {
    const longName =
      "2026-quarterly-board-update-with-a-very-long-name-that-truncates-in-the-list.md";

    render(
      <FileListItem
        entry={createEntry(longName)}
        checked={false}
        onCheckedChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const openButton = screen.getByRole("button", {
      name: `Open ${longName}`,
    });
    const tooltip = screen
      .getAllByText(longName)
      .find((element) => element.getAttribute("role") === "tooltip");

    if (!tooltip) {
      throw new Error("Expected a custom filename tooltip");
    }

    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveTextContent(longName);
    expect(openButton.getAttribute("aria-describedby")?.split(/\s+/)).toContain(
      tooltip.id,
    );
    expect(openButton).not.toHaveAttribute("title");
  });

  it("keeps ready and saved states compact so the filename has priority", () => {
    render(
      <FileListItem
        entry={createEntry("quarterly-board-update.md")}
        checked={false}
        saveStatus="saved"
        onCheckedChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(document.querySelector(".file-list-item-copy")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Markdown is ready to review.")).toHaveClass(
      "status-indicator--compact",
    );
    expect(screen.getByLabelText("Saved to disk.")).toHaveClass(
      "file-list-save-status--compact",
    );
  });

  it("uses short visible labels for warning and error states", () => {
    const warningText = "Tables may need review.";
    const { rerender } = render(
      <FileListItem
        entry={createEntry("review-needed.pdf", {
          status: "warning",
          warnings: [warningText],
        })}
        checked={false}
        onCheckedChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByLabelText(warningText)).not.toHaveClass(
      "status-indicator--compact",
    );

    rerender(
      <FileListItem
        entry={createEntry("failed-file.pdf", { status: "error" })}
        checked={false}
        onCheckedChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByLabelText("Unable to convert this file.")).not.toHaveClass(
      "status-indicator--compact",
    );
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../../types";
import FileListItem from "../FileListItem";

function createEntry(name: string): FileEntry {
  return {
    id: "entry-1",
    file: new File(["# Test"], name, { type: "text/markdown" }),
    name,
    format: "md",
    status: "success",
    markdown: "# Test",
    warnings: [],
    selected: false,
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
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent(longName);
    expect(openButton).toHaveAttribute("aria-describedby", tooltip.id);
    expect(openButton).not.toHaveAttribute("title");
  });
});

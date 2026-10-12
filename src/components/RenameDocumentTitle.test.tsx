import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RenameDocumentTitle from "./RenameDocumentTitle";
import { markdownRename } from "../utils/markdownRename";

describe("RenameDocumentTitle", () => {
  it("confirms a new output stem with the Markdown extension", async () => {
    const rename = vi.fn();
    render(<RenameDocumentTitle name="Original.docx" onRename={rename} />);
    fireEvent.click(screen.getByRole("button", { name: /^Rename document:/ }));
    const input = screen.getByRole("textbox", { name: "Document name" });
    expect(input).toHaveValue("Original");
    fireEvent.change(input, { target: { value: " New report " } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(rename).toHaveBeenCalledWith("New report.md"));
  });

  it("cancels without modifying the filename", () => {
    const rename = vi.fn();
    render(<RenameDocumentTitle name="Notes.md" onRename={rename} />);
    fireEvent.click(screen.getByRole("button", { name: /^Rename document:/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Other" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(rename).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Rename document:/ }),
    ).toBeVisible();
  });

  it("preserves the draft and shows a native rename failure", async () => {
    const rename = vi
      .fn()
      .mockRejectedValue(new Error("A file with that name already exists."));
    render(<RenameDocumentTitle name="Notes.md" onRename={rename} />);
    fireEvent.click(screen.getByRole("button", { name: /^Rename document:/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Existing" },
    });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    expect(screen.getByRole("textbox")).toHaveValue("Existing");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
  });

  it.each([
    "",
    "..",
    "../notes",
    "a/b",
    "a\\b",
    "a:b",
    "a\u0000b",
    "a".repeat(253),
  ])("rejects invalid name %j", (name) => {
    expect(() => markdownRename(name)).toThrow();
  });
  it("avoids duplicating a pasted Markdown extension", () => {
    expect(markdownRename("Notes.md")).toBe("Notes.md");
  });
});

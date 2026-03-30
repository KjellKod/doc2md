import { describe, expect, it } from "vitest";
import {
  displayName,
  entryDisplayName,
  scratchDisplayName,
} from "./displayName";

describe("displayName", () => {
  it("decodes %20 to spaces", () => {
    expect(displayName("My%20File.pdf")).toBe("My File.pdf");
  });

  it("decodes other percent-encoded characters", () => {
    expect(displayName("report%20%28draft%29.docx")).toBe(
      "report (draft).docx",
    );
  });

  it("returns the original name when no encoding is present", () => {
    expect(displayName("plain-file.txt")).toBe("plain-file.txt");
  });

  it("returns the original name for malformed percent sequences", () => {
    expect(displayName("100%_done.txt")).toBe("100%_done.txt");
  });

  it("returns the original name for truncated percent sequences", () => {
    expect(displayName("file%2")).toBe("file%2");
  });
});

describe("scratchDisplayName", () => {
  it("falls back to Untitled.md for empty input", () => {
    expect(scratchDisplayName()).toBe("Untitled.md");
    expect(scratchDisplayName("")).toBe("Untitled.md");
    expect(scratchDisplayName("   \n\t")).toBe("Untitled.md");
  });

  it("uses the first non-empty line and strips markdown headings", () => {
    expect(scratchDisplayName("\n\n# My Draft\nBody")).toBe("My Draft");
  });

  it("truncates long scratch labels", () => {
    expect(
      scratchDisplayName(
        "This title is definitely longer than forty characters for testing",
      ),
    ).toBe("This title is definitely longer than for...");
  });
});

describe("entryDisplayName", () => {
  it("prefers the scratch label for scratch entries", () => {
    expect(
      entryDisplayName({
        name: "Untitled.md",
        editedMarkdown: "# Session Notes",
        isScratch: true,
      }),
    ).toBe("Session Notes");
  });

  it("falls back to the file name for uploaded entries", () => {
    expect(
      entryDisplayName({
        name: "report%20final.docx",
        editedMarkdown: "# Ignored",
        isScratch: false,
      }),
    ).toBe("report final.docx");
  });
});

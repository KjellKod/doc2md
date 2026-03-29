import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../types";
import { downloadEntry } from "./download";

function createEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: "test-1",
    file: new File([""], "test.txt"),
    name: "test.txt",
    format: "txt",
    status: "success",
    markdown: "# Original",
    warnings: [],
    selected: true,
    ...overrides
  };
}

describe("downloadEntry", () => {
  let capturedContent: string[];
  const mockLink = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn()
  };

  beforeEach(() => {
    capturedContent = [];

    const OriginalBlob = globalThis.Blob;

    vi.spyOn(globalThis, "Blob").mockImplementation(
      // @ts-expect-error -- mocking constructor
      (parts: BlobPart[]) => {
        capturedContent.push(parts.map(String).join(""));
        return new OriginalBlob(parts);
      }
    );

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue(
      mockLink as unknown as HTMLAnchorElement
    );

    vi.spyOn(document.body, "append").mockImplementation(
      () => mockLink as unknown as HTMLAnchorElement
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses editedMarkdown when present", () => {
    downloadEntry(createEntry({ editedMarkdown: "# Edited content" }));

    expect(capturedContent).toHaveLength(1);
    expect(capturedContent[0]).toBe("# Edited content");
  });

  it("falls back to markdown when editedMarkdown is undefined", () => {
    downloadEntry(createEntry());

    expect(capturedContent).toHaveLength(1);
    expect(capturedContent[0]).toBe("# Original");
  });

  it("uses editedMarkdown over markdown even when both present", () => {
    downloadEntry(
      createEntry({ markdown: "# Original", editedMarkdown: "# Changed" })
    );

    expect(capturedContent[0]).toBe("# Changed");
  });
});

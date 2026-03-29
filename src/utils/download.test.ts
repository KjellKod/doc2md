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
  let OriginalBlob: typeof Blob;
  const mockLink = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn()
  };

  beforeEach(() => {
    vi.useFakeTimers();
    capturedContent = [];

    OriginalBlob = globalThis.Blob;

    globalThis.Blob = class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedContent.push(parts.map(String).join(""));
      }
    } as typeof Blob;

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
    vi.useRealTimers();
    globalThis.Blob = OriginalBlob;
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

  it("defers link removal and URL revocation by 1 second", () => {
    downloadEntry(createEntry());

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.remove).not.toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(mockLink.remove).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:mock-url"
    );
  });
});

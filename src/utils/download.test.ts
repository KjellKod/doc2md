import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileEntry } from "../types";
import {
  createHtmlFileName,
  downloadEntry,
  downloadHtmlFile,
  isDownloadableEntry,
} from "./download";

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
    ...overrides,
  };
}

describe("downloadEntry", () => {
  let capturedContent: string[];
  let OriginalBlob: typeof Blob;
  const mockLink = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn(),
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
      mockLink as unknown as HTMLAnchorElement,
    );

    vi.spyOn(document.body, "append").mockImplementation(
      () => mockLink as unknown as HTMLAnchorElement,
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
      createEntry({ markdown: "# Original", editedMarkdown: "# Changed" }),
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
      "blob:mock-url",
    );
  });

  it("does not treat empty scratch drafts as downloadable", () => {
    expect(
      isDownloadableEntry(
        createEntry({
          name: "Untitled.md",
          format: "md",
          markdown: "",
          editedMarkdown: "",
          isScratch: true,
        }),
      ),
    ).toBe(false);
  });

  it("treats scratch drafts with content as downloadable", () => {
    expect(
      isDownloadableEntry(
        createEntry({
          name: "Untitled.md",
          format: "md",
          markdown: "",
          editedMarkdown: "# Draft",
          isScratch: true,
        }),
      ),
    ).toBe(true);
  });
});

describe("createHtmlFileName", () => {
  it("swaps the extension to .html", () => {
    expect(createHtmlFileName("report.pdf")).toBe("report.html");
    expect(createHtmlFileName("notes.md")).toBe("notes.html");
  });

  it("appends .html when there is no extension", () => {
    expect(createHtmlFileName("Untitled")).toBe("Untitled.html");
  });

  it("does not treat a leading-dot name as an extension", () => {
    expect(createHtmlFileName(".env")).toBe(".env.html");
  });
});

describe("downloadHtmlFile", () => {
  let capturedContent: string[];
  let capturedTypes: (string | undefined)[];
  let OriginalBlob: typeof Blob;
  const mockLink = {
    href: "",
    download: "",
    click: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    capturedContent = [];
    capturedTypes = [];
    OriginalBlob = globalThis.Blob;

    globalThis.Blob = class extends OriginalBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        capturedContent.push(parts.map(String).join(""));
        capturedTypes.push(options?.type);
      }
    } as typeof Blob;

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue(
      mockLink as unknown as HTMLAnchorElement,
    );
    vi.spyOn(document.body, "append").mockImplementation(
      () => mockLink as unknown as HTMLAnchorElement,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Blob = OriginalBlob;
    vi.restoreAllMocks();
  });

  it("downloads an html blob with the html MIME type and .html filename", () => {
    downloadHtmlFile("report.pdf", "<!DOCTYPE html><html></html>");

    expect(capturedContent).toEqual(["<!DOCTYPE html><html></html>"]);
    expect(capturedTypes).toEqual(["text/html;charset=utf-8"]);
    expect(mockLink.download).toBe("report.html");
    expect(mockLink.click).toHaveBeenCalled();
  });
});

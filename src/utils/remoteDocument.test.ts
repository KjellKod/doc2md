import { describe, expect, it, vi } from "vitest";
import {
  MAX_BROWSER_FILE_SIZE_BYTES,
  OVERSIZED_FILE_MESSAGE,
} from "../converters/messages";
import {
  deriveRemoteDocumentFileName,
  downloadRemoteDocument,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
  REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE,
  REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS,
  REMOTE_DOCUMENT_TIMEOUT_MESSAGE,
} from "./remoteDocument";

describe("remoteDocument", () => {
  it("uses the URL path file name when it already includes an extension", () => {
    expect(
      deriveRemoteDocumentFileName(
        new URL("https://example.com/files/Quarterly%20Review.pdf"),
        new Headers(),
        "application/pdf",
      ),
    ).toBe("Quarterly Review.pdf");
  });

  it("prefers content-disposition file names and appends a missing extension from the mime type", () => {
    expect(
      deriveRemoteDocumentFileName(
        new URL("https://example.com/download?id=42"),
        new Headers({
          "content-disposition":
            "attachment; filename*=UTF-8''Roadmap%20v2",
        }),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("Roadmap v2.docx");
  });

  it("falls back to the URL segment and mime type when the path has no extension", () => {
    expect(
      deriveRemoteDocumentFileName(
        new URL("https://example.com/download"),
        new Headers(),
        "text/plain; charset=utf-8",
      ),
    ).toBe("download.txt");
  });

  it("downloads a remote document into a File", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-disposition": 'attachment; filename="notes.txt"',
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["hello"], { type: "text/plain" })),
    });

    const file = await downloadRemoteDocument(
      "https://example.com/download?doc=notes",
      { fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/download?doc=notes",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("notes.txt");
    expect(file.type).toBe("text/plain");
    expect(file.size).toBe(5);
  });

  it("rejects invalid URLs", async () => {
    await expect(
      downloadRemoteDocument("not-a-url", { fetchImpl: vi.fn() }),
    ).rejects.toThrow(INVALID_REMOTE_DOCUMENT_URL_MESSAGE);
  });

  it("maps network and browser access failures to a user-facing message", async () => {
    await expect(
      downloadRemoteDocument(
        "https://example.com/report.pdf",
        { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) },
      ),
    ).rejects.toThrow(REMOTE_DOCUMENT_BROWSER_ACCESS_MESSAGE);
  });

  it("maps auth-gated responses to a user-facing message", async () => {
    await expect(
      downloadRemoteDocument(
        "https://example.com/report.pdf",
        {
          fetchImpl: vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            headers: new Headers(),
            blob: vi.fn(),
          }),
        },
      ),
    ).rejects.toThrow(
      "We couldn't download that document because the URL requires sign-in or additional access.",
    );
  });

  it("maps 404 responses to a user-facing message", async () => {
    await expect(
      downloadRemoteDocument(
        "https://example.com/missing.pdf",
        {
          fetchImpl: vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            headers: new Headers(),
            blob: vi.fn(),
          }),
        },
      ),
    ).rejects.toThrow(
      "We couldn't download that document because the URL returned 404 Not Found.",
    );
  });

  it("maps other HTTP failures to a status-aware message", async () => {
    await expect(
      downloadRemoteDocument(
        "https://example.com/error.pdf",
        {
          fetchImpl: vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            headers: new Headers(),
            blob: vi.fn(),
          }),
        },
      ),
    ).rejects.toThrow(
      "We couldn't download that document because the server responded with HTTP 502.",
    );
  });

  it("passes through direct remote URLs unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/docs/README.md",
      headers: new Headers(),
      blob: vi.fn().mockResolvedValue(new Blob(["# docs"], { type: "text/markdown" })),
    });

    await downloadRemoteDocument(
      "https://example.com/docs/README.md",
      { fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/docs/README.md",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects oversized remote files from content-length before reading the body", async () => {
    const blobSpy = vi.fn();

    await expect(
      downloadRemoteDocument("https://example.com/report.pdf", {
        fetchImpl: vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers({
            "content-length": String(MAX_BROWSER_FILE_SIZE_BYTES + 1),
          }),
          blob: blobSpy,
        }),
      }),
    ).rejects.toThrow(OVERSIZED_FILE_MESSAGE);

    expect(blobSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized remote files after download when content-length is absent", async () => {
    const oversizedBlob = new Blob(["tiny"], {
      type: "application/pdf",
    });
    Object.defineProperty(oversizedBlob, "size", {
      value: MAX_BROWSER_FILE_SIZE_BYTES + 1,
    });

    await expect(
      downloadRemoteDocument("https://example.com/report.pdf", {
        fetchImpl: vi.fn().mockResolvedValue({
          ok: true,
          headers: new Headers(),
          blob: vi.fn().mockResolvedValue(oversizedBlob),
        }),
      }),
    ).rejects.toThrow(OVERSIZED_FILE_MESSAGE);
  });

  it("maps aborted fetches to a timeout message", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_input, init?: RequestInit) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }) as unknown as typeof fetch;

      const pending = downloadRemoteDocument("https://example.com/report.pdf", {
        fetchImpl: fetchMock,
        timeoutMs: REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS,
      });
      const expectation = expect(pending).rejects.toThrow(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);

      await vi.advanceTimersByTimeAsync(REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps aborted body reads to a timeout message", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_input, init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          headers: new Headers(),
          blob: () =>
            new Promise((_, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }),
        }),
      );

      const pending = downloadRemoteDocument("https://example.com/report.pdf", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        timeoutMs: REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS,
      });
      const expectation = expect(pending).rejects.toThrow(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);

      await vi.advanceTimersByTimeAsync(REMOTE_DOCUMENT_DOWNLOAD_TIMEOUT_MS);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createInputFileFromUrl,
  DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS,
  deriveRemoteDocumentFileName,
  INVALID_REMOTE_DOCUMENT_URL_MESSAGE,
  isRemoteUrl,
  REMOTE_DOCUMENT_ACCESS_FAILED_MESSAGE,
  REMOTE_DOCUMENT_TIMEOUT_MESSAGE,
} from "./remoteDocument";

describe("core remoteDocument", () => {
  it("detects remote URLs", () => {
    expect(isRemoteUrl("https://example.com/report.pdf")).toBe(true);
    expect(isRemoteUrl("http://example.com/report.pdf")).toBe(true);
    expect(isRemoteUrl("/tmp/report.pdf")).toBe(false);
    expect(isRemoteUrl("not-a-url")).toBe(false);
  });

  it("derives filenames from response headers and content types", () => {
    expect(
      deriveRemoteDocumentFileName(
        new URL("https://example.com/download?id=42"),
        new Headers({
          "content-disposition": "attachment; filename*=UTF-8''Roadmap%20v2",
        }),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("Roadmap v2.docx");
  });

  it("creates a File from a remote URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-disposition": 'attachment; filename="notes.txt"',
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["hello"], { type: "text/plain" })),
    });

    const file = await createInputFileFromUrl("https://example.com/download?id=7", {
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/download?id=7",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(file.name).toBe("notes.txt");
    expect(file.type).toBe("text/plain");
  });

  it("passes direct remote URLs through unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/docs/README.md",
      headers: new Headers(),
      blob: vi.fn().mockResolvedValue(new Blob(["# docs"], { type: "text/markdown" })),
    });

    const file = await createInputFileFromUrl(
      "https://example.com/docs/README.md",
      { fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/docs/README.md",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(file.name).toBe("README.md");
  });

  it("rejects invalid remote URLs", async () => {
    await expect(
      createInputFileFromUrl("not-a-url", { fetchImpl: vi.fn() }),
    ).rejects.toThrow(INVALID_REMOTE_DOCUMENT_URL_MESSAGE);
  });

  it("maps network failures to an actionable error", async () => {
    await expect(
      createInputFileFromUrl("https://example.com/private.docx", {
        fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      }),
    ).rejects.toThrow(REMOTE_DOCUMENT_ACCESS_FAILED_MESSAGE);
  });

  it("maps auth-gated responses to an actionable error", async () => {
    await expect(
      createInputFileFromUrl("https://example.com/private.docx", {
        fetchImpl: vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          headers: new Headers(),
          blob: vi.fn(),
        }),
      }),
    ).rejects.toThrow(
      "We couldn't download that document because the URL requires sign-in or additional access.",
    );
  });

  it("maps 404 responses to an actionable error", async () => {
    await expect(
      createInputFileFromUrl("https://example.com/missing.docx", {
        fetchImpl: vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          headers: new Headers(),
          blob: vi.fn(),
        }),
      }),
    ).rejects.toThrow(
      "We couldn't download that document because the URL returned 404 Not Found.",
    );
  });

  it("maps aborted fetches to a timeout error", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_input, init?: RequestInit) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      const pending = createInputFileFromUrl("https://example.com/slow.docx", {
        fetchImpl: fetchMock,
        timeoutMs: DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS,
      });
      const expectation = expect(pending).rejects.toThrow(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);

      await vi.advanceTimersByTimeAsync(DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps aborted body reads to a timeout error", async () => {
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

      const pending = createInputFileFromUrl("https://example.com/slow.docx", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        timeoutMs: DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS,
      });
      const expectation = expect(pending).rejects.toThrow(REMOTE_DOCUMENT_TIMEOUT_MESSAGE);

      await vi.advanceTimersByTimeAsync(DEFAULT_REMOTE_DOCUMENT_TIMEOUT_MS);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

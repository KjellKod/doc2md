import { describe, expect, it } from "vitest";
import { normalizeGitHubDocumentUrl } from "./githubUrl";

describe("normalizeGitHubDocumentUrl", () => {
  it("normalizes a GitHub blob URL to the raw branch URL", () => {
    expect(
      normalizeGitHubDocumentUrl(
        new URL("https://github.com/KjellKod/doc2md/blob/main/README.md"),
      ).toString(),
    ).toBe(
      "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md",
    );
  });

  it("normalizes a blob URL with nested paths", () => {
    expect(
      normalizeGitHubDocumentUrl(
        new URL("https://github.com/KjellKod/doc2md/blob/main/docs/guides/setup.md"),
      ).toString(),
    ).toBe(
      "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/docs/guides/setup.md",
    );
  });

  it("passes through raw GitHub URLs", () => {
    expect(
      normalizeGitHubDocumentUrl(
        new URL("https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md"),
      ).toString(),
    ).toBe(
      "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md",
    );
  });

  it("passes through non-GitHub URLs", () => {
    expect(
      normalizeGitHubDocumentUrl(
        new URL("https://example.com/report.pdf"),
      ).toString(),
    ).toBe("https://example.com/report.pdf");
  });

  it("passes through GitHub paths that are not blob document URLs", () => {
    expect(
      normalizeGitHubDocumentUrl(
        new URL("https://github.com/KjellKod/doc2md/issues/1"),
      ).toString(),
    ).toBe("https://github.com/KjellKod/doc2md/issues/1");
  });
});

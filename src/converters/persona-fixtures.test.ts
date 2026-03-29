import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const FIXTURES_DIR = path.resolve(process.cwd(), "test-fixtures");

function loadFixture(filename: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename));
}

function createFile(buffer: Buffer, name: string, type: string): File {
  return new File([buffer], name, { type });
}

/**
 * Key phrases that should appear in any faithful conversion of persona.md.
 * Ordered roughly by document structure — headings, then body content.
 */
const EXPECTED_PHRASES = [
  "Persona Guide",
  "Character",
  "Agent Names",
  "Jean-Claude",
  "Dexter",
  "Voice Contract",
  "Cross-Agent Conversations",
  "When to Talk",
  "How to Invoke Dexter",
  "How to Record",
  "Quest Integration",
  "Callback Memory Rules",
  "User Interaction Memory",
  "What to Remember",
  "Where to Store",
  "How to Apply",
  "PR and Code Review Pattern",
  "Commit Message Style",
  "Safety",
  "Smart, fast, and useful first",
  "Witty second",
  "Dry humor and occasional snark",
  "Keep answers short and direct",
  "No fabricated metrics",
];

/** Headings that should be rendered as markdown headings (# or ##) */
const EXPECTED_HEADINGS = [
  "Persona Guide",
  "Character",
  "Agent Names",
  "Voice Contract",
  "Safety",
];

describe("persona fixture: HTML", () => {
  it("converts persona_test.html with high fidelity", async () => {
    const { convertHtml } = await import("./html");
    const buffer = loadFixture("persona_test.html");
    const file = createFile(buffer, "persona_test.html", "text/html");
    const result = await convertHtml(file);

    expect(result.status).toBe("success");
    for (const phrase of EXPECTED_PHRASES) {
      expect(result.markdown).toContain(phrase);
    }
    // HTML should produce proper markdown headings
    for (const heading of EXPECTED_HEADINGS) {
      expect(result.markdown).toMatch(new RegExp(`^#{1,3} .*${heading}`, "m"));
    }

    // HTML should preserve nested list structure (sub-items indented)
    expect(result.markdown).toMatch(/^ {2,}- first response in a new conversation/m);
    expect(result.markdown).toMatch(/^ {2,}- when asked identity directly/m);
    expect(result.markdown).toMatch(/^ {2,}- first message after a long quiet period/m);
  });
});

describe("persona fixture: DOCX", () => {
  it("converts persona_test.docx with high fidelity", async () => {
    const { convertDocx } = await import("./docx");
    const buffer = loadFixture("persona_test.docx");
    const file = createFile(buffer, "persona_test.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const result = await convertDocx(file);

    expect(result.status).not.toBe("error");
    for (const phrase of EXPECTED_PHRASES) {
      expect(result.markdown).toContain(phrase);
    }
  });
});

describe("persona fixture: TXT", () => {
  it("converts persona_test.txt preserving all content", async () => {
    const { convertTxt } = await import("./txt");
    const buffer = loadFixture("persona_test.txt");
    const file = createFile(buffer, "persona_test.txt", "text/plain");
    const result = await convertTxt(file);

    expect(result.status).toBe("success");
    for (const phrase of EXPECTED_PHRASES) {
      expect(result.markdown).toContain(phrase);
    }
  });
});

describe("persona fixture: MD (passthrough)", () => {
  it("passes through persona_test.md unchanged", async () => {
    const { convertMd } = await import("./md");
    const buffer = loadFixture("persona_test.md");
    const file = createFile(buffer, "persona_test.md", "text/markdown");
    const result = await convertMd(file);

    expect(result.status).toBe("success");
    for (const phrase of EXPECTED_PHRASES) {
      expect(result.markdown).toContain(phrase);
    }
    // MD passthrough should preserve heading markers
    expect(result.markdown).toContain("# **Persona Guide**");
    expect(result.markdown).toContain("## **Character**");
  });
});

describe("persona fixture: PDF", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("pdfjs-dist/legacy/build/pdf.mjs");
  });

  it("extracts key content from persona_test.pdf", async () => {
    vi.resetModules();
    vi.doUnmock("pdfjs-dist/legacy/build/pdf.mjs");
    const { convertPdf } = await import("./pdf");

    const buffer = loadFixture("persona_test.pdf");
    const file = createFile(buffer, "persona_test.pdf", "application/pdf");
    const result = await convertPdf(file);

    expect(result.status).not.toBe("error");
    // PDF extraction is lossy — check key phrases are present
    const essentialPhrases = [
      "Persona Guide",
      "Character",
      "Jean-Claude",
      "Dexter",
      "Voice Contract",
      "Safety",
      "Smart, fast, and useful first",
    ];
    for (const phrase of essentialPhrases) {
      expect(result.markdown).toContain(phrase);
    }

    // PDF should not contain raw Unicode circle bullets
    expect(result.markdown).not.toContain("\u25CB");

    // PDF bullets should use consistent `- ` prefix
    expect(result.markdown).toMatch(/^- /m);

    // PDF should have heading structure
    expect(result.markdown).toMatch(/^# /m);
    expect(result.markdown).toMatch(/^## /m);
  });
});

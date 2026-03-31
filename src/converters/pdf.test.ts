import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRUPT_FILE_MESSAGE } from "./messages";

const PDF_MIME_TYPE = "application/pdf";

function createPdfFile(contents: BlobPart[], fileName = "sample.pdf") {
  return new File(contents, fileName, {
    type: PDF_MIME_TYPE
  });
}

async function importPdfModule() {
  vi.resetModules();
  vi.doUnmock("pdfjs-dist/legacy/build/pdf.mjs");

  return import("./pdf");
}

function textItem(str: string, transform: number[], fontName: string, hasEOL = true) {
  return { str, transform, fontName, hasEOL, dir: "ltr" as const, width: 100, height: transform[0] };
}

function repeatedCharacters(length: number) {
  return "x".repeat(length);
}

describe("renderPdfPageText", () => {
  it("classifies three distinct heading sizes into H1, H2, H3", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const bodySize = 12;
    const items = [
      textItem("Main Title", [20, 0, 0, 20, 0, 700], "f1"),
      textItem("Section Header", [16, 0, 0, 16, 0, 660], "f1"),
      textItem("Subsection", [14, 0, 0, 14, 0, 620], "f1"),
      textItem("Body text here.", [bodySize, 0, 0, bodySize, 0, 580], "f2"),
    ];
    const profile = { bodyFontSize: bodySize, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("# Main Title");
    expect(result).toContain("## Section Header");
    expect(result).toContain("### Subsection");
    expect(result).toContain("Body text here.");
    expect(result).not.toMatch(/^#{1,3} Body text/m);
  });

  it("demotes date-like lines from headings to bold text", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const items = [
      textItem("March 2022 - September 2024", [14, 0, 0, 14, 0, 700], "f1"),
      textItem("2015-2017", [14, 0, 0, 14, 0, 660], "f1"),
      textItem("Body text.", [12, 0, 0, 12, 0, 620], "f2"),
    ];
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("**March 2022 - September 2024**");
    expect(result).toContain("**2015-2017**");
    expect(result).not.toMatch(/^#{1,3} March/m);
    expect(result).not.toMatch(/^#{1,3} 2015/m);
  });

  it("demotes URL-only lines from headings to plain text", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const items = [
      textItem("https://kigo.pro", [14, 0, 0, 14, 0, 700], "f1"),
      textItem("Body text.", [12, 0, 0, 12, 0, 660], "f2"),
    ];
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("https://kigo.pro");
    expect(result).not.toMatch(/^#{1,3} https:/m);
  });

  it("maps single heading size to H3 when delta is small", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const items = [
      textItem("Only Heading", [14, 0, 0, 14, 0, 700], "f1"),
      textItem("Body.", [12, 0, 0, 12, 0, 660], "f2"),
    ];
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("### Only Heading");
  });
});

describe("mergeBulletContinuations", () => {
  it("merges a lowercase continuation into the preceding bullet", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Smart, fast, and useful first",
      "with dry humor",
    ]);
    expect(result).toEqual(["- Smart, fast, and useful first with dry humor"]);
  });

  it("merges a punctuation-led continuation into the preceding bullet", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Journal files are numbered sequentially (001, 002,",
      "...) and stored under docs/journal/",
    ]);
    expect(result).toEqual([
      "- Journal files are numbered sequentially (001, 002, ...) and stored under docs/journal/",
    ]);
  });

  it("does not merge when previous bullet ends with terminal punctuation", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Complete sentence here.",
      "next paragraph starts",
    ]);
    expect(result).toEqual([
      "- Complete sentence here.",
      "next paragraph starts",
    ]);
  });

  it("does not merge when next line starts with uppercase", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Some bullet item",
      "New separate thought",
    ]);
    expect(result).toEqual([
      "- Some bullet item",
      "New separate thought",
    ]);
  });

  it("does not merge across blank lines", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Some bullet item",
      "",
      "next paragraph text",
    ]);
    expect(result).toEqual([
      "- Some bullet item",
      "",
      "next paragraph text",
    ]);
  });

  it("does not merge headings or bullets into a bullet", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- First bullet",
      "- Second bullet",
      "## A Heading",
    ]);
    expect(result).toEqual([
      "- First bullet",
      "- Second bullet",
      "## A Heading",
    ]);
  });
});

describe("mergePageTexts", () => {
  it("merges body text split across pages", async () => {
    const { mergePageTexts } = await importPdfModule();
    const result = mergePageTexts([
      "First paragraph starts here and continues",
      "across the page boundary seamlessly.",
    ]);

    expect(result).toContain("continues across the page");
    expect(result).not.toContain("\n\nacross");
  });

  it("does not merge when the next page starts with a heading", async () => {
    const { mergePageTexts } = await importPdfModule();
    const result = mergePageTexts([
      "End of previous section.",
      "# New Section\n\nNew content here.",
    ]);

    expect(result).toContain("End of previous section.");
    expect(result).toContain("# New Section");
    expect(result).not.toContain("section. # New");
  });

  it("does not merge when previous line ends with sentence punctuation", async () => {
    const { mergePageTexts } = await importPdfModule();
    const result = mergePageTexts([
      "Complete sentence ending here.",
      "New paragraph starting fresh.",
    ]);

    expect(result).not.toContain("here. New paragraph");
    expect(result).toContain("Complete sentence ending here.");
    expect(result).toContain("New paragraph starting fresh.");
  });

  it("does not merge when next line starts with ALL CAPS", async () => {
    const { mergePageTexts } = await importPdfModule();
    const result = mergePageTexts([
      "End of section text without period",
      "ACHIEVEMENTS section starts here",
    ]);

    expect(result).not.toContain("period ACHIEVEMENTS");
  });

  it("drops empty pages silently", async () => {
    const { mergePageTexts } = await importPdfModule();
    const result = mergePageTexts(["Content here.", "", "  ", "More content."]);

    expect(result).toContain("Content here.");
    expect(result).toContain("More content.");
    expect(result).not.toContain("_No extractable text");
  });
});

describe("classifyPdfQuality", () => {
  it("returns poor quality when no meaningful text is detected", async () => {
    const { classifyPdfQuality, PDF_LOW_TEXT_MESSAGE } = await importPdfModule();

    expect(classifyPdfQuality(["", "  "])).toEqual({
      status: "error",
      warnings: [PDF_LOW_TEXT_MESSAGE],
      quality: {
        level: "poor",
        summary:
          "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
      },
      signals: {
        lowSelectableText: true,
        sparseText: true,
        fragmentedLines: true,
      },
    });
  });

  it("returns review quality for sparse fragmented text", async () => {
    const { classifyPdfQuality, PDF_LAYOUT_WARNING_MESSAGE } =
      await importPdfModule();

    expect(
      classifyPdfQuality([
        "Short line\nTiny bit\nLoose row\nBrief text\nJagged block",
        "Fragmented line\nMultiple rows\nAnother clipped sentence\nBroken layout",
      ]),
    ).toEqual({
      status: "warning",
      warnings: [PDF_LAYOUT_WARNING_MESSAGE],
      quality: {
        level: "review",
        summary:
          "Review: Text was extracted, but layout may be fragmented or out of reading order.",
      },
      signals: {
        lowSelectableText: false,
        sparseText: true,
        fragmentedLines: true,
      },
    });
  });

  it("returns good quality for normal text density", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const pageText = [
      "Readable content with enough words to feel like normal prose and avoid the sparse threshold.",
      "Another paragraph with enough sentence structure to look straightforward for markdown conversion.",
    ].join("\n");

    expect(classifyPdfQuality([pageText])).toEqual({
      status: "success",
      warnings: [],
      quality: {
        level: "good",
        summary: "Good: Selectable text detected. Layout looks straightforward.",
      },
      signals: {
        lowSelectableText: false,
        sparseText: false,
        fragmentedLines: false,
      },
    });
  });

  it("treats the low-text threshold as poor below 50 chars/page and review at 50", async () => {
    const { classifyPdfQuality } = await importPdfModule();

    expect(classifyPdfQuality([repeatedCharacters(49)])).toMatchObject({
      status: "error",
      quality: { level: "poor" },
    });

    expect(classifyPdfQuality([repeatedCharacters(50)])).toMatchObject({
      status: "warning",
      quality: { level: "review" },
    });
  });

  it("treats the layout-density threshold as review below 140 chars/page and good at 140", async () => {
    const { classifyPdfQuality } = await importPdfModule();

    expect(classifyPdfQuality([repeatedCharacters(139)])).toMatchObject({
      status: "warning",
      quality: { level: "review" },
    });

    expect(classifyPdfQuality([repeatedCharacters(140)])).toMatchObject({
      status: "success",
      quality: { level: "good" },
    });
  });

  it("treats the average characters-per-line threshold as review below 24 and good at 24", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const linesAt23 = Array.from({ length: 7 }, () => repeatedCharacters(23)).join("\n");
    const linesAt24 = Array.from({ length: 7 }, () => repeatedCharacters(24)).join("\n");

    expect(classifyPdfQuality([linesAt23])).toMatchObject({
      status: "warning",
      quality: { level: "review" },
      signals: { fragmentedLines: true },
    });

    expect(classifyPdfQuality([linesAt24])).toMatchObject({
      status: "success",
      quality: { level: "good" },
      signals: { fragmentedLines: false },
    });
  });

  it("treats the short-line ratio threshold as review above 0.75 and good at exactly 0.75", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const ratioAboveThreshold = [
      repeatedCharacters(10),
      repeatedCharacters(10),
      repeatedCharacters(10),
      repeatedCharacters(10),
      repeatedCharacters(100),
    ].join("\n");
    const ratioAtThreshold = [
      repeatedCharacters(10),
      repeatedCharacters(10),
      repeatedCharacters(10),
      repeatedCharacters(110),
    ].join("\n");

    expect(classifyPdfQuality([ratioAboveThreshold])).toMatchObject({
      status: "warning",
      quality: { level: "review" },
      signals: { fragmentedLines: true },
    });

    expect(classifyPdfQuality([ratioAtThreshold])).toMatchObject({
      status: "success",
      quality: { level: "good" },
      signals: { fragmentedLines: false },
    });
  });
});

describe("convertPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("pdfjs-dist/legacy/build/pdf.mjs");
  });

  it("extracts text from the sample PDF fixture", async () => {
    const { convertPdf } = await importPdfModule();
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.pdf"));
    const result = await convertPdf(createPdfFile([fixture]));

    expect(result).toMatchObject({
      warnings: [],
      status: "success",
      quality: {
        level: "good",
        summary: "Good: Selectable text detected. Layout looks straightforward.",
      },
    });
    expect(result.markdown).not.toContain("## Page ");
    expect(result.markdown).toContain("Sample PDF");
    expect(result.markdown).toContain("This PDF is intentionally text-based");
  });

  it("returns the exact scanned-PDF message for the image-based fixture", async () => {
    const { PDF_LOW_TEXT_MESSAGE, convertPdf } = await importPdfModule();
    const fixture = fs.readFileSync(
      path.resolve(process.cwd(), "test-fixtures/sample-scanned.pdf")
    );
    const result = await convertPdf(createPdfFile([fixture], "sample-scanned.pdf"));

    expect(result).toEqual({
      markdown: "",
      warnings: [PDF_LOW_TEXT_MESSAGE],
      status: "error",
      quality: {
        level: "poor",
        summary:
          "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
      },
    });
  });

  it("warns when extractable text looks sparse and merges pages", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn(async (pageNumber: number) => ({
            getTextContent: vi.fn(async () => ({
              items:
                pageNumber === 1
                  ? [
                      {
                        str: "Sparse layout intro",
                        transform: [1, 0, 0, 1, 0, 720],
                        hasEOL: true
                      },
                      {
                        str: "Short paragraph split",
                        transform: [1, 0, 0, 1, 0, 700],
                        hasEOL: true
                      },
                      {
                        str: "Another clipped line",
                        transform: [1, 0, 0, 1, 0, 680],
                        hasEOL: true
                      }
                    ]
                  : [
                      {
                        str: "A fragmented second page",
                        transform: [1, 0, 0, 1, 0, 720],
                        hasEOL: true
                      },
                      {
                        str: "Multiple short rows appear",
                        transform: [1, 0, 0, 1, 0, 700],
                        hasEOL: true
                      },
                      {
                        str: "Spacing stays suspicious",
                        transform: [1, 0, 0, 1, 0, 720],
                        hasEOL: true
                      }
                    ]
            }))
          }))
        }),
        destroy
      }))
    }));

    const { PDF_LAYOUT_WARNING_MESSAGE, convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([1, 2, 3])], "sparse.pdf"));

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual([PDF_LAYOUT_WARNING_MESSAGE]);
    expect(result.quality).toEqual({
      level: "review",
      summary:
        "Review: Text was extracted, but layout may be fragmented or out of reading order.",
    });
    expect(result.markdown).not.toContain("## Page ");
    expect(result.markdown).toContain("Sparse layout intro");
    expect(result.markdown).toContain("A fragmented second page");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("handles corrupt PDFs with an error result", async () => {
    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      getDocument: vi.fn(() => ({
        promise: Promise.reject(new Error("bad pdf")),
        destroy: vi.fn().mockResolvedValue(undefined)
      }))
    }));

    const { convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([37, 80, 68, 70])], "bad.pdf"));

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error",
      quality: {
        level: "poor",
        summary:
          "Poor: Could not assess PDF quality because this PDF could not be read.",
      },
    });
  });

  it("does not wait forever for PDF.js worker cleanup after a successful conversion", async () => {
    const destroyFn = vi.fn(() => new Promise<void>(() => {}));

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn(async () => ({
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str:
                    "Readable PDF content that should convert cleanly with enough text to satisfy the quality threshold.",
                  transform: [12, 0, 0, 12, 0, 720],
                  fontName: "f1",
                  hasEOL: true
                }
              ]
            }))
          }))
        }),
        destroy: destroyFn
      }))
    }));

    const { convertPdf } = await import("./pdf");

    // If convertPdf awaits the never-resolving destroy(), this test will hit
    // the runner's default timeout — proving the bug.  A passing test proves
    // destroy() is fire-and-forget.
    const result = await convertPdf(
      createPdfFile([new Uint8Array([37, 80, 68, 70])], "cleanup-stall.pdf")
    );

    expect(result).toMatchObject({ markdown: expect.any(String) });
    expect(destroyFn).toHaveBeenCalled();
  });
});

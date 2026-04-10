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

function textItem(
  str: string,
  transform: number[],
  fontName: string,
  hasEOL = true,
  width = 100
) {
  return { str, transform, fontName, hasEOL, dir: "ltr" as const, width, height: transform[0] };
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

  it("folds superscript symbols into the surrounding heading text", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("Acme", [20, 0, 0, 20, 0, 700], "f1", false, 45),
      textItem("®", [12, 0, 0, 12, 48, 700], "f1", false, 10),
      textItem("Coverage", [20, 0, 0, 20, 62, 700], "f1", true, 90),
      textItem("Body text.", [12, 0, 0, 12, 0, 660], "f2"),
    ];

    expect(renderPdfPageText(items, profile)).toContain("# Acme® Coverage");
  });

  it("folds superscript symbols when the glyph sits slightly above the text baseline", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("Acme", [20, 0, 0, 20, 0, 700], "f1", false, 45),
      textItem("®", [12, 0, 0, 12, 46, 705], "f1", false, 10),
      textItem("Coverage", [20, 0, 0, 20, 60, 700], "f1", true, 90),
      textItem("Body text.", [12, 0, 0, 12, 0, 660], "f2"),
    ];

    expect(renderPdfPageText(items, profile)).toContain("# Acme® Coverage");
  });

  it("does not fold small non-symbol text into the previous item", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("Acme", [20, 0, 0, 20, 0, 700], "f1", false, 45),
      textItem("beta", [12, 0, 0, 12, 48, 700], "f1", false, 24),
      textItem("Coverage", [20, 0, 0, 20, 82, 700], "f1", true, 90),
      textItem("Body text.", [12, 0, 0, 12, 0, 660], "f2"),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("# Acme beta Coverage");
    expect(result).not.toContain("# Acmebeta Coverage");
  });

  it("suppresses spaces for tightly kerned text while keeping real word gaps", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("202", [12, 0, 0, 12, 0, 700], "f2", false, 18),
      textItem("6", [12, 0, 0, 12, 19, 700], "f2", true, 6),
      textItem("hello", [12, 0, 0, 12, 0, 660], "f2", false, 30),
      textItem("world", [12, 0, 0, 12, 48, 660], "f2", true, 30),
    ];

    expect(renderPdfPageText(items, profile)).toContain("2026");
    expect(renderPdfPageText(items, profile)).toContain("hello world");
  });

  it("preserves hasEOL line breaks even when adjacent rows share the same y-position", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("First", [12, 0, 0, 12, 0, 700], "f2", false, 24),
      textItem("line", [12, 0, 0, 12, 36, 700], "f2", true, 18),
      textItem("Second", [12, 0, 0, 12, 0, 700], "f2", false, 36),
      textItem("line", [12, 0, 0, 12, 48, 700], "f2", true, 18),
    ];

    expect(renderPdfPageText(items, profile)).toContain("First line\nSecond line");
    expect(renderPdfPageText(items, profile)).not.toContain("First line Second line");
  });

  it("strips TOC dot leaders while preserving page numbers and normal punctuation", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("Coverage Rationale ............................................................ 12", [12, 0, 0, 12, 0, 700], "f2"),
      textItem("Examples include etc.", [12, 0, 0, 12, 0, 660], "f2"),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("Coverage Rationale 12");
    expect(result).not.toContain("....");
    expect(result).toContain("Examples include etc.");
  });

  it("keeps TOC entries together before rendering a right-side policy sidebar", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = {
      bodyFontSize: 10,
      bodyFontName: "f2",
      boldFontNames: new Set<string>(["fBold"])
    };
    const items = [
      textItem("Table of Contents", [10, 0, 0, 10, 36, 700], "fBold", false, 96),
      textItem("Page", [10, 0, 0, 10, 280, 700], "fBold", true, 24),
      textItem("Related Commercial Policies", [10, 0, 0, 10, 340, 698], "fBold", true, 140),
      textItem("Coverage Rationale ............................................................ 1", [10, 0, 0, 10, 36, 680], "f2"),
      textItem("•", [10, 0, 0, 10, 340, 678], "f2", false, 6),
      textItem("Maximum Dosage and Frequency", [10, 0, 0, 10, 356, 678], "f2", true, 148),
      textItem("Applicable Codes ................................................................ 7", [10, 0, 0, 10, 36, 660], "f2"),
      textItem("Coverage Rationale", [14, 0, 0, 14, 36, 620], "fBold"),
    ];

    const result = renderPdfPageText(items, profile);

    expect(result.indexOf("Coverage Rationale")).toBeLessThan(result.indexOf("Applicable Codes"));
    expect(result.indexOf("Applicable Codes")).toBeLessThan(
      result.indexOf("Related Commercial Policies")
    );
    expect(result).toContain("**Table of Contents**");
    expect(result).toContain("**Related Commercial Policies**");
    expect(result).toContain("- Maximum Dosage and Frequency");
  });

  it("detects aligned rows as a markdown table before prose rendering", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("HCPCS Code", [12, 0, 0, 12, 36, 720], "f2", false, 60),
      textItem("Description", [12, 0, 0, 12, 180, 720], "f2", true, 80),
      textItem("J1745", [12, 0, 0, 12, 36, 700], "f2", false, 40),
      textItem("Infusion", [12, 0, 0, 12, 180, 700], "f2", true, 60),
      textItem("J9999", [12, 0, 0, 12, 36, 680], "f2", false, 40),
      textItem("Review needed", [12, 0, 0, 12, 180, 680], "f2", true, 90),
      textItem("J1111", [12, 0, 0, 12, 36, 660], "f2", false, 40),
      textItem("Approved", [12, 0, 0, 12, 180, 660], "f2", true, 60),
      textItem("Closing prose line.", [12, 0, 0, 12, 36, 620], "f2"),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("| HCPCS Code | Description |");
    expect(result).toContain("| --- | --- |");
    expect(result).toContain("| J1745 | Infusion |");
    expect(result).toContain("Closing prose line.");
  });

  it("clusters close x-positions so multi-fragment table cells stay in one column", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("HCPCS Code", [12, 0, 0, 12, 36, 720], "f2", false, 60),
      textItem("Description", [12, 0, 0, 12, 180, 720], "f2", true, 80),
      textItem("J1745", [12, 0, 0, 12, 36, 700], "f2", false, 40),
      textItem("App", [12, 0, 0, 12, 180, 700], "fBold", false, 12),
      textItem("roved", [12, 0, 0, 12, 187, 700], "f2", true, 28),
      textItem("J9999", [12, 0, 0, 12, 36, 680], "f2", false, 40),
      textItem("Pending", [12, 0, 0, 12, 180, 680], "f2", true, 54),
      textItem("J1111", [12, 0, 0, 12, 36, 660], "f2", false, 40),
      textItem("Denied", [12, 0, 0, 12, 180, 660], "f2", true, 48),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("| HCPCS Code | Description |");
    expect(result).toContain("| J1745 | Approved |");
    expect(result).not.toContain("| J1745 | App | roved |");
  });

  it("does not trigger table rendering for prose with scattered x-positions", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("This", [12, 0, 0, 12, 36, 720], "f2", false, 24),
      textItem("paragraph", [12, 0, 0, 12, 122, 720], "f2", false, 54),
      textItem("wanders.", [12, 0, 0, 12, 248, 720], "f2", true, 48),
      textItem("Another", [12, 0, 0, 12, 42, 700], "f2", false, 42),
      textItem("sentence", [12, 0, 0, 12, 168, 700], "f2", false, 48),
      textItem("shifts.", [12, 0, 0, 12, 314, 700], "f2", true, 42),
      textItem("Final", [12, 0, 0, 12, 58, 680], "f2", false, 30),
      textItem("line", [12, 0, 0, 12, 144, 680], "f2", false, 24),
      textItem("floats.", [12, 0, 0, 12, 286, 680], "f2", true, 42),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("This paragraph wanders.");
    expect(result).toContain("Another sentence shifts.");
    expect(result).toContain("Final line floats.");
    expect(result).not.toContain("| --- |");
  });

  it("preserves nested list indentation from x-position and non-body o bullets", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>(["fBold"]) };
    const items = [
      textItem("Overview paragraph.", [12, 0, 0, 12, 18, 740], "f2"),
      textItem("•", [12, 0, 0, 12, 18, 700], "f2", false, 8),
      textItem("Parent", [12, 0, 0, 12, 34, 700], "f2", true, 40),
      textItem("o", [12, 0, 0, 12, 36, 680], "CourierNewPSMT", false, 8),
      textItem("Child", [12, 0, 0, 12, 52, 680], "f2", true, 34),
      textItem("•", [12, 0, 0, 12, 54, 660], "f2", false, 8),
      textItem("Grandchild", [12, 0, 0, 12, 70, 660], "f2", true, 70),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("- Parent");
    expect(result).toContain("  - Child");
    expect(result).toContain("    - Grandchild");
  });

  it("ignores table rows when deriving the base x for later bullets", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>() };
    const items = [
      textItem("Column A", [12, 0, 0, 12, 18, 760], "f2", false, 52),
      textItem("Column B", [12, 0, 0, 12, 180, 760], "f2", true, 52),
      textItem("A1", [12, 0, 0, 12, 18, 740], "f2", false, 16),
      textItem("B1", [12, 0, 0, 12, 180, 740], "f2", true, 16),
      textItem("A2", [12, 0, 0, 12, 18, 720], "f2", false, 16),
      textItem("B2", [12, 0, 0, 12, 180, 720], "f2", true, 16),
      textItem("A3", [12, 0, 0, 12, 18, 700], "f2", false, 16),
      textItem("B3", [12, 0, 0, 12, 180, 700], "f2", true, 16),
      textItem("Lead-in paragraph.", [12, 0, 0, 12, 36, 660], "f2"),
      textItem("•", [12, 0, 0, 12, 36, 640], "f2", false, 8),
      textItem("Flat bullet after table", [12, 0, 0, 12, 52, 640], "f2", true, 110),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("| Column A | Column B |");
    expect(result).toContain("Lead-in paragraph.");
    expect(result).toContain("- Flat bullet after table");
    expect(result).not.toContain("  - Flat bullet after table");
  });

  it("emits inline bold markers for mixed-font body lines", async () => {
    const { renderPdfPageText } = await importPdfModule();
    const profile = { bodyFontSize: 12, bodyFontName: "f2", boldFontNames: new Set<string>(["fBold"]) };
    const items = [
      textItem("See", [12, 0, 0, 12, 0, 700], "f2", false, 18),
      textItem("Benefit Considerations", [12, 0, 0, 12, 28, 700], "fBold", false, 126),
      textItem("for details", [12, 0, 0, 12, 160, 700], "f2", true, 60),
      textItem("Important Note", [12, 0, 0, 12, 0, 660], "fBold"),
      textItem("Plain follow-up.", [12, 0, 0, 12, 0, 620], "f2"),
    ];
    const result = renderPdfPageText(items, profile);

    expect(result).toContain("See **Benefit Considerations** for details");
    expect(result).toContain("**Important Note**");
    expect(result).toContain("Plain follow-up.");
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

  it("does not merge indented child bullets into their parent bullet", async () => {
    const { mergeBulletContinuations } = await importPdfModule();
    const result = mergeBulletContinuations([
      "- Parent bullet",
      "  - Child bullet",
    ]);

    expect(result).toEqual([
      "- Parent bullet",
      "  - Child bullet",
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

    expect(result.markdown).toBe("");
    expect(result.warnings).toEqual([PDF_LOW_TEXT_MESSAGE]);
    expect(result.status).toBe("error");
    expect(result.quality?.level).toBe("poor");
    expect(result.quality?.summary).toContain(
      "Poor: Little or no selectable text detected. This PDF may be scanned or image-based."
    );
  });

  it("warns when extractable text looks sparse and merges pages", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn(async (pageNumber: number) => ({
            getOperatorList: vi.fn(async () => ({ fnArray: [], argsArray: [] })),
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
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
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
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn(async () => ({
            getOperatorList: vi.fn(async () => ({ fnArray: [], argsArray: [] })),
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

  it("strips repeating headers and footers across three or more pages", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const header = {
      str: "Policy Handbook",
      transform: [12, 0, 0, 12, 0, 1000],
      fontName: "f1",
      hasEOL: true,
      width: 140
    };
    const footerForPage = (pageNumber: number) => ({
      str: `Page ${pageNumber}`,
      transform: [12, 0, 0, 12, 0, 20],
      fontName: "f1",
      hasEOL: true,
      width: 60
    });

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: vi.fn(async (pageNumber: number) => ({
            getOperatorList: vi.fn(async () => ({ fnArray: [], argsArray: [] })),
            getTextContent: vi.fn(async () => ({
              items: [
                header,
                footerForPage(pageNumber),
                {
                  str: `Body copy on page ${pageNumber} with enough readable text to avoid the sparse-quality warning threshold.`,
                  transform: [12, 0, 0, 12, 0, 760],
                  fontName: "f2",
                  hasEOL: true,
                  width: 540
                }
              ]
            }))
          }))
        }),
        destroy
      }))
    }));

    const { convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([1, 2, 3])], "repeating-layout.pdf"));

    expect(result.markdown).toContain("Body copy on page 1");
    expect(result.markdown).toContain("Body copy on page 2");
    expect(result.markdown).toContain("Body copy on page 3");
    expect(result.markdown).not.toContain("Policy Handbook");
    expect(result.markdown).not.toContain("Page 1");
    expect(result.markdown).not.toContain("Page 2");
    expect(result.markdown).not.toContain("Page 3");
  });

  it("does not strip repeated body rows when viewport height keeps them out of header bands", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: {
        workerSrc: ""
      },
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: vi.fn(async (pageNumber: number) => ({
            getOperatorList: vi.fn(async () => ({ fnArray: [], argsArray: [] })),
            getViewport: vi.fn(() => ({ height: 1000 })),
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str: "Repeated body row stays in content.",
                  transform: [12, 0, 0, 12, 0, 760],
                  fontName: "f2",
                  hasEOL: true,
                  width: 220
                },
                {
                  str: `Page ${pageNumber} details remain visible with enough readable text to avoid sparse output.`,
                  transform: [12, 0, 0, 12, 0, 700],
                  fontName: "f2",
                  hasEOL: true,
                  width: 520
                }
              ]
            }))
          }))
        }),
        destroy
      }))
    }));

    const { convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([1, 2, 3])], "body-rows.pdf"));
    const repeatedCount = result.markdown.match(/Repeated body row stays in content\./g)?.length ?? 0;

    expect(repeatedCount).toBe(3);
    expect(result.markdown).toContain("Page 1 details remain visible");
    expect(result.markdown).toContain("Page 2 details remain visible");
    expect(result.markdown).toContain("Page 3 details remain visible");
  });

  it("strips diagonal watermark text and prepends a watermark note", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const angle45 = Math.PI / 4;
    const cos45 = Math.cos(angle45) * 72;
    const sin45 = Math.sin(angle45) * 72;

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: { workerSrc: "" },
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 3,
          getPage: vi.fn(async (pageNumber: number) => ({
            getViewport: vi.fn(() => ({ height: 1000 })),
            getOperatorList: vi.fn(async () => ({ fnArray: [], argsArray: [] })),
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str: "HIGH RISK ALERT",
                  transform: [cos45, sin45, -sin45, cos45, 104, 159],
                  fontName: "watermark-font",
                  hasEOL: true,
                  width: 300
                },
                {
                  str: `Body content on page ${pageNumber} with enough text to pass the quality threshold check for sparse detection.`,
                  transform: [12, 0, 0, 12, 50, 700],
                  fontName: "f2",
                  hasEOL: true,
                  width: 500
                }
              ]
            }))
          }))
        }),
        destroy
      }))
    }));

    const { convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([1, 2, 3])], "watermark.pdf"));

    expect(result.markdown).toContain("> [Watermark removed: HIGH RISK ALERT]");
    expect(result.markdown).not.toMatch(/(?<!> \[Watermark removed: )HIGH RISK ALERT(?!\])/);
    expect(result.markdown).toContain("Body content on page 1");
    expect(result.markdown).toContain("Body content on page 2");
    expect(result.markdown).toContain("Body content on page 3");
  });

  it("detects embedded images and downgrades quality from good to review", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
      GlobalWorkerOptions: { workerSrc: "" },
      OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintImageXObjectRepeat: 88 },
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn(async () => ({
            getOperatorList: vi.fn(async () => ({
              fnArray: [85, 85, 86],
              argsArray: [[], [], []]
            })),
            getTextContent: vi.fn(async () => ({
              items: [
                {
                  str: "This document has embedded images alongside plenty of text content to be considered well formatted.",
                  transform: [12, 0, 0, 12, 50, 700],
                  fontName: "f1",
                  hasEOL: true,
                  width: 500
                }
              ]
            }))
          }))
        }),
        destroy
      }))
    }));

    const { convertPdf } = await import("./pdf");
    const result = await convertPdf(createPdfFile([new Uint8Array([1, 2, 3])], "images.pdf"));

    expect(result.quality?.level).toBe("review");
    expect(result.quality?.summary).toContain("3 image(s) detected that could not be converted to markdown");
    expect(result.status).toBe("warning");
  });
});

describe("detectWatermarkItems", () => {
  it("identifies rotated text appearing on majority of pages", async () => {
    const { detectWatermarkItems } = await importPdfModule();
    const angle45 = Math.PI / 4;
    const cos45 = Math.cos(angle45) * 72;
    const sin45 = Math.sin(angle45) * 72;

    const watermarkItem = (pageY: number) =>
      textItem("HIGH RISK ALERT", [cos45, sin45, -sin45, cos45, 104, pageY], "wm-font", true);
    const bodyItem = (text: string, y: number) =>
      textItem(text, [12, 0, 0, 12, 50, y], "f2", true);

    const pages = [
      { items: [watermarkItem(159), bodyItem("Page 1", 700)], height: 800 },
      { items: [watermarkItem(159), bodyItem("Page 2", 700)], height: 800 },
      { items: [watermarkItem(159), bodyItem("Page 3", 700)], height: 800 },
    ];

    const result = detectWatermarkItems(pages);

    expect(result.fingerprints.size).toBe(1);
    expect(result.fingerprints.has("high risk alert")).toBe(true);
    expect(result.watermarkText).toBe("HIGH RISK ALERT");
  });

  it("ignores rotated text appearing on too few pages", async () => {
    const { detectWatermarkItems } = await importPdfModule();
    const angle45 = Math.PI / 4;
    const cos45 = Math.cos(angle45) * 72;
    const sin45 = Math.sin(angle45) * 72;

    const watermarkItem =
      textItem("DRAFT", [cos45, sin45, -sin45, cos45, 100, 400], "wm-font", true);
    const bodyItem = (text: string) =>
      textItem(text, [12, 0, 0, 12, 50, 700], "f2", true);

    const pages = [
      { items: [watermarkItem, bodyItem("Page 1")], height: 800 },
      { items: [bodyItem("Page 2")], height: 800 },
      { items: [bodyItem("Page 3")], height: 800 },
      { items: [bodyItem("Page 4")], height: 800 },
    ];

    const result = detectWatermarkItems(pages);

    expect(result.fingerprints.size).toBe(0);
    expect(result.watermarkText).toBeNull();
  });
});

describe("stripWatermarkItems", () => {
  it("removes rotated matches and keeps non-rotated text with same content", async () => {
    const { stripWatermarkItems } = await importPdfModule();
    const angle45 = Math.PI / 4;
    const cos45 = Math.cos(angle45) * 72;
    const sin45 = Math.sin(angle45) * 72;

    const rotatedItem = textItem("DRAFT", [cos45, sin45, -sin45, cos45, 100, 400], "wm", true);
    const bodyItem = textItem("DRAFT", [12, 0, 0, 12, 50, 700], "f2", true);
    const otherItem = textItem("Normal text", [12, 0, 0, 12, 50, 600], "f2", true);

    const fingerprints = new Set(["draft"]);
    const result = stripWatermarkItems([rotatedItem, bodyItem, otherItem], fingerprints);

    expect(result).toHaveLength(2);
    expect(result[0].str).toBe("DRAFT");
    expect(result[0].transform[1]).toBe(0);
    expect(result[1].str).toBe("Normal text");
  });
});

describe("classifyPdfQuality with imageCount", () => {
  it("downgrades good to review when images are present", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const pages = [
      "x".repeat(200) + "\n" + "y".repeat(200),
    ];
    const result = classifyPdfQuality(pages, 3);

    expect(result.quality.level).toBe("review");
    expect(result.quality.summary).toContain("3 image(s) detected");
    expect(result.status).toBe("warning");
    expect(result.signals.imageCount).toBe(3);
  });

  it("appends image note to existing review without changing level", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const pages = ["a".repeat(60) + "\n" + "b".repeat(10)];
    const result = classifyPdfQuality(pages, 2);

    expect(result.quality.level).toBe("review");
    expect(result.quality.summary).toContain("2 image(s) detected");
  });

  it("returns unchanged result when imageCount is 0", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const pages = [
      "x".repeat(200) + "\n" + "y".repeat(200),
    ];
    const result = classifyPdfQuality(pages, 0);

    expect(result.quality.level).toBe("good");
    expect(result.quality.summary).not.toContain("image");
    expect(result.signals.imageCount).toBeUndefined();
  });

  it("defaults imageCount to 0 when omitted", async () => {
    const { classifyPdfQuality } = await importPdfModule();
    const pages = [
      "x".repeat(200) + "\n" + "y".repeat(200),
    ];
    const result = classifyPdfQuality(pages);

    expect(result.quality.level).toBe("good");
    expect(result.signals.imageCount).toBeUndefined();
  });
});

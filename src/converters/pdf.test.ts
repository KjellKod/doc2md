import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const PDF_MIME_TYPE = "application/pdf";

function createPdfFile(contents: BlobPart[], fileName = "sample.pdf") {
  return new File(contents, fileName, {
    type: PDF_MIME_TYPE
  });
}

async function importPdfModule() {
  vi.resetModules();
  vi.unmock("pdfjs-dist/legacy/build/pdf.mjs");

  return import("./pdf");
}

describe("convertPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unmock("pdfjs-dist/legacy/build/pdf.mjs");
  });

  it("extracts text from the sample PDF fixture", async () => {
    const { convertPdf } = await importPdfModule();
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.pdf"));
    const result = await convertPdf(createPdfFile([fixture]));

    expect(result).toMatchObject({
      warnings: [],
      status: "success"
    });
    expect(result.markdown).toContain("## Page 1");
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
      status: "error"
    });
  });

  it("adds page headings and warns when extractable text looks sparse", async () => {
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
    expect(result.markdown).toContain("## Page 1");
    expect(result.markdown).toContain("## Page 2");
    expect(result.markdown).toContain("Sparse layout intro");
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
      warnings: ["This PDF file could not be read. It may be corrupted or use unsupported content."],
      status: "error"
    });
  });
});

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRUPT_FILE_MESSAGE } from "./messages";

const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function createPptxFile(contents: BlobPart[], fileName = "sample.pptx") {
  return new File(contents, fileName, {
    type: PPTX_MIME_TYPE
  });
}

async function importPptxModule() {
  vi.resetModules();
  vi.doUnmock("jszip");

  return import("./pptx");
}

describe("convertPptx", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("jszip");
  });

  it("extracts slide titles and body text from the sample PPTX fixture", async () => {
    const { convertPptx } = await importPptxModule();
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.pptx"));
    const result = await convertPptx(createPptxFile([fixture]));

    expect(result).toMatchObject({
      warnings: [],
      status: "success"
    });
    expect(result.markdown).toContain("## Slide 1: Sample Presentation");
    expect(result.markdown).toContain("- A simple 4-slide deck with titles and bullet points");
    expect(result.markdown).toContain("## Slide 2: Agenda");
    expect(result.markdown).toContain("- Review a short project-style update");
    expect(result.markdown).toContain("## Slide 4: Next Steps");
  });

  it("renders a slide note when a slide contains no extractable text", async () => {
    const mockZip = {
      file: vi.fn((filePath: string) => {
        const files: Record<string, string> = {
          "ppt/presentation.xml":
            '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="rId1"/></p:sldIdLst></p:presentation>',
          "ppt/_rels/presentation.xml.rels":
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>',
          "ppt/slides/slide1.xml":
            '<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Image Slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
        };
        const content = files[filePath];

        return content
          ? {
              async: vi.fn(async () => content)
            }
          : null;
      })
    };

    vi.doMock("jszip", () => ({
      default: {
        loadAsync: vi.fn(async () => mockZip)
      }
    }));

    const { convertPptx } = await import("./pptx");
    const result = await convertPptx(createPptxFile([new Uint8Array([1, 2, 3])], "image-only.pptx"));

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("## Slide 1: Image Slide");
    expect(result.markdown).toContain("This slide contains no extractable text.");
  });

  it("handles corrupt PPTX files with an error result", async () => {
    vi.doMock("jszip", () => ({
      default: {
        loadAsync: vi.fn(async () => {
          throw new Error("bad zip");
        })
      }
    }));

    const { convertPptx } = await import("./pptx");
    const result = await convertPptx(createPptxFile([new Uint8Array([80, 75, 3, 4])], "bad.pptx"));

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});

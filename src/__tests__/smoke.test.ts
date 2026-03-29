import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertFile } from "../converters";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  UNSUPPORTED_FILE_MESSAGE
} from "../converters/messages";

function readFixture(fileName: string) {
  return fs.readFileSync(path.resolve(process.cwd(), "test-fixtures", fileName));
}

function withArrayBuffer(file: File, contents: BlobPart[]) {
  if (typeof file.arrayBuffer === "function") {
    return file;
  }

  const buffers = contents.map((part) => {
    if (typeof part === "string") {
      return Uint8Array.from(Buffer.from(part));
    }

    if (part instanceof ArrayBuffer) {
      return new Uint8Array(part);
    }

    if (ArrayBuffer.isView(part)) {
      return new Uint8Array(
        part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength)
      );
    }

    throw new TypeError("Unsupported BlobPart in smoke test fixture");
  });
  const length = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;

  for (const buffer of buffers) {
    combined.set(buffer, offset);
    offset += buffer.byteLength;
  }

  Object.defineProperty(file, "arrayBuffer", {
    value: async () => combined.buffer.slice(0)
  });

  return file;
}

function createFixtureFile(fileName: string, type: string) {
  const contents = [readFixture(fileName)];
  return withArrayBuffer(new File(contents, fileName, { type }), contents);
}

describe("doc2md smoke coverage", () => {
  it("converts .txt to markdown", async () => {
    const result = await convertFile(
      new File(["Plain text for smoke coverage"], "smoke.txt", {
        type: "text/plain"
      })
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toBe("Plain text for smoke coverage");
  });

  it("converts .json to a fenced code block", async () => {
    const result = await convertFile(
      new File(['{"service":"doc2md","ready":true}'], "smoke.json", {
        type: "application/json"
      })
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("```json");
    expect(result.markdown).toContain('"service": "doc2md"');
  });

  it("converts .csv to a markdown table", async () => {
    const result = await convertFile(
      new File(["name,role\nJean-Claude,Planner"], "smoke.csv", {
        type: "text/csv"
      })
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("| name | role |");
    expect(result.markdown).toContain("| Jean-Claude | Planner |");
  });

  it("converts .tsv to a markdown table", async () => {
    const result = await convertFile(
      new File(["name\trole\nDexter\tBuilder"], "smoke.tsv", {
        type: "text/tab-separated-values"
      })
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("| name | role |");
    expect(result.markdown).toContain("| Dexter | Builder |");
  });

  it("converts .html to semantic markdown", async () => {
    const result = await convertFile(createFixtureFile("sample.html", "text/html"));

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("# doc2md");
    expect(result.markdown).toContain("## Why it matters");
  });

  it("converts .docx to markdown from a real fixture", async () => {
    const result = await convertFile(
      createFixtureFile(
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("# Overview");
    expect(result.markdown).toContain("| Item | Owner | Status |");
  });

  it("converts .xlsx to markdown tables from a real fixture", async () => {
    const result = await convertFile(
      createFixtureFile(
        "sample.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("## Sheet: Projects");
    expect(result.markdown).toContain("| Project | Owner | Status |");
  });

  it("converts .pdf with text extraction from a real fixture", async () => {
    const result = await convertFile(createFixtureFile("sample.pdf", "application/pdf"));

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("## Page 1");
    expect(result.markdown).toContain("Sample PDF");
  });

  it("converts .pptx to slide sections from a real fixture", async () => {
    const result = await convertFile(
      createFixtureFile(
        "sample.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    );

    expect(result.status).toBe("success");
    expect(result.markdown).toContain("## Slide 1: Sample Presentation");
    expect(result.markdown).toContain("## Slide 4: Next Steps");
  });

  it("handles mixed-format batch conversion independently", async () => {
    const files = [
      new File(["Batch text"], "batch.txt", { type: "text/plain" }),
      new File(['{"batch":true}'], "batch.json", { type: "application/json" }),
      new File(["team,owner\nQuest,Jean-Claude"], "batch.csv", {
        type: "text/csv"
      }),
      createFixtureFile("sample.pdf", "application/pdf")
    ];

    const results = await Promise.all(files.map((file) => convertFile(file)));

    expect(results).toHaveLength(4);
    expect(results[0].markdown).toBe("Batch text");
    expect(results[1].markdown).toContain("```json");
    expect(results[2].markdown).toContain("| team | owner |");
    expect(results[3].markdown).toContain("## Page 1");
    expect(results.every((result) => result.status === "success")).toBe(true);
  });

  it("converts 10 identical files concurrently without stalling", async () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      new File([`Document number ${i + 1}`], `doc-${i + 1}.txt`, { type: "text/plain" })
    );

    const results = await Promise.all(files.map((file) => convertFile(file)));

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.status === "success")).toBe(true);
    results.forEach((r, i) => {
      expect(r.markdown).toBe(`Document number ${i + 1}`);
    });
  });

  it("converts 10 identical PDFs concurrently without stalling", async () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createFixtureFile("sample.pdf", "application/pdf")
    );

    const results = await Promise.all(files.map((file) => convertFile(file)));

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.status === "success")).toBe(true);
    results.forEach((r) => {
      expect(r.markdown).toContain("## Page 1");
    });
  }, 30_000);

  it("returns the unsupported-format message", async () => {
    const result = await convertFile(
      new File(["binary-ish"], "smoke.exe", {
        type: "application/octet-stream"
      })
    );

    expect(result).toEqual({
      markdown: "",
      warnings: [UNSUPPORTED_FILE_MESSAGE],
      status: "error"
    });
  });

  it("returns the empty-file message", async () => {
    const result = await convertFile(
      createFixtureFile("sample-empty.txt", "text/plain")
    );

    expect(result).toEqual({
      markdown: "",
      warnings: [EMPTY_FILE_MESSAGE],
      status: "error"
    });
  });

  it("treats malformed structured input as a corrupt file", async () => {
    const result = await convertFile(
      createFixtureFile("sample-malformed.json", "application/json")
    );

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});

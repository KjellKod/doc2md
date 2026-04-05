import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertFile } from "../converters";

const fixturePath = path.resolve(process.cwd(), "test-fixtures/sample.pdf");
const goldenPath = path.resolve(
  process.cwd(),
  "test-fixtures/sample.pdf.browser-golden.json"
);

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

    throw new TypeError("Unsupported BlobPart in PDF golden fixture");
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

function createFixtureFile() {
  const contents = [fs.readFileSync(fixturePath)];
  return withArrayBuffer(
    new File(contents, "sample.pdf", { type: "application/pdf" }),
    contents
  );
}

describe("PDF browser golden artifact", () => {
  it("matches the committed browser-path PDF quality artifact", async () => {
    const result = await convertFile(createFixtureFile());
    const payload = {
      quality: result.quality
    };

    if (process.env.UPDATE_PDF_GOLDEN === "1") {
      fs.writeFileSync(goldenPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }

    const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
    expect(payload).toEqual(golden);
  });
});

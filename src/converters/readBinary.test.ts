import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileAsArrayBuffer } from "./readBinary";

type BinaryReadBehavior =
  | { type: "success"; result: unknown }
  | { type: "error" };

let nextBehavior: BinaryReadBehavior = {
  type: "success",
  result: new Uint8Array([1, 2, 3]).buffer
};

class MockBinaryFileReader {
  result: unknown = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsArrayBuffer() {
    if (nextBehavior.type === "error") {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      return;
    }

    this.result = nextBehavior.result;
    this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
  }
}

describe("readFileAsArrayBuffer", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockBinaryFileReader as unknown as typeof FileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the reader array buffer result", async () => {
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
    nextBehavior = { type: "success", result: arrayBuffer };

    await expect(readFileAsArrayBuffer(new Blob(["ignored"]))).resolves.toBe(arrayBuffer);
  });

  it("rejects when the reader result is not an array buffer", async () => {
    nextBehavior = { type: "success", result: "not-binary" };

    await expect(readFileAsArrayBuffer(new Blob(["ignored"]))).rejects.toThrow(
      "Unable to read file contents."
    );
  });

  it("rejects when the reader reports an error", async () => {
    nextBehavior = { type: "error" };

    await expect(readFileAsArrayBuffer(new Blob(["ignored"]))).rejects.toThrow(
      "Unable to read file contents."
    );
  });
});

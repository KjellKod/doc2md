import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileAsText } from "./readText";

type TextReadBehavior =
  | { type: "success"; result: unknown }
  | { type: "error" };

let nextBehavior: TextReadBehavior = { type: "success", result: "" };

class MockTextFileReader {
  result: unknown = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsText() {
    if (nextBehavior.type === "error") {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      return;
    }

    this.result = nextBehavior.result;
    this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
  }
}

describe("readFileAsText", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockTextFileReader as unknown as typeof FileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the reader string result", async () => {
    nextBehavior = { type: "success", result: "Converted text" };

    await expect(readFileAsText(new Blob(["ignored"]))).resolves.toBe("Converted text");
  });

  it("falls back to an empty string when the reader does not return text", async () => {
    nextBehavior = { type: "success", result: new ArrayBuffer(8) };

    await expect(readFileAsText(new Blob(["ignored"]))).resolves.toBe("");
  });

  it("rejects when the reader reports an error", async () => {
    nextBehavior = { type: "error" };

    await expect(readFileAsText(new Blob(["ignored"]))).rejects.toThrow(
      "Unable to read file contents."
    );
  });
});

import { describe, expect, it } from "vitest";
import { parseArgs } from "./cli-options";

describe("parseArgs", () => {
  it("parses valid numeric options", () => {
    expect(
      parseArgs(["sample.txt", "-o", "out", "--max", "5", "--concurrency", "2"])
    ).toEqual({
      inputs: ["sample.txt"],
      outputDir: "out",
      maxDocuments: 5,
      concurrency: 2
    });
  });

  it("rejects invalid --max values", () => {
    expect(() => parseArgs(["sample.txt", "-o", "out", "--max", "abc"])).toThrow(
      "Invalid value for --max"
    );
    expect(() => parseArgs(["sample.txt", "-o", "out", "--max", "10abc"])).toThrow(
      "Invalid value for --max"
    );
    expect(() => parseArgs(["sample.txt", "-o", "out", "--max", "2.5"])).toThrow(
      "Invalid value for --max"
    );
  });

  it("rejects invalid --concurrency values", () => {
    expect(
      () => parseArgs(["sample.txt", "-o", "out", "--concurrency", "0"])
    ).toThrow("Invalid value for --concurrency");
  });

  it("returns a help sentinel for --help", () => {
    expect(parseArgs(["--help"])).toEqual({ help: true });
  });

  it("returns a help sentinel for -h", () => {
    expect(parseArgs(["-h"])).toEqual({ help: true });
  });

  it("rejects a missing output directory", () => {
    expect(() => parseArgs(["sample.txt"])).toThrow(
      "Missing required output directory"
    );
  });

  it("rejects missing input files", () => {
    expect(() => parseArgs(["-o", "out"])).toThrow("No input files provided");
  });
});

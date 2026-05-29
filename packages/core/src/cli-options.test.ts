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
      concurrency: 2,
      remoteTimeoutMs: undefined,
      format: "md"
    });
  });

  it("accepts mixed local paths and remote URLs", () => {
    expect(
      parseArgs([
        "sample.txt",
        "https://example.com/docs/README.md",
        "-o",
        "out",
        "--remote-timeout-ms",
        "45000"
      ])
    ).toEqual({
      inputs: [
        "sample.txt",
        "https://example.com/docs/README.md"
      ],
      outputDir: "out",
      maxDocuments: undefined,
      concurrency: undefined,
      remoteTimeoutMs: 45000,
      format: "md"
    });
  });

  it("defaults format to md", () => {
    const result = parseArgs(["sample.txt", "-o", "out"]);
    expect("help" in result).toBe(false);
    if (!("help" in result)) {
      expect(result.format).toBe("md");
    }
  });

  it("parses --format md|html|both", () => {
    for (const format of ["md", "html", "both"] as const) {
      const result = parseArgs(["sample.txt", "-o", "out", "--format", format]);
      expect("help" in result).toBe(false);
      if (!("help" in result)) {
        expect(result.format).toBe(format);
      }
    }
  });

  it("rejects an unknown --format value", () => {
    expect(() =>
      parseArgs(["sample.txt", "-o", "out", "--format", "pdf"])
    ).toThrow("Invalid value for --format");
  });

  it("rejects a missing --format value", () => {
    expect(() => parseArgs(["sample.txt", "-o", "out", "--format"])).toThrow(
      "Invalid value for --format"
    );
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

  it("rejects invalid --remote-timeout-ms values", () => {
    expect(
      () => parseArgs(["sample.txt", "-o", "out", "--remote-timeout-ms", "0"])
    ).toThrow("Invalid value for --remote-timeout-ms");
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

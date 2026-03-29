import { describe, expect, it } from "vitest";
import { displayName } from "./displayName";

describe("displayName", () => {
  it("decodes %20 to spaces", () => {
    expect(displayName("My%20File.pdf")).toBe("My File.pdf");
  });

  it("decodes other percent-encoded characters", () => {
    expect(displayName("report%20%28draft%29.docx")).toBe("report (draft).docx");
  });

  it("returns the original name when no encoding is present", () => {
    expect(displayName("plain-file.txt")).toBe("plain-file.txt");
  });

  it("returns the original name for malformed percent sequences", () => {
    expect(displayName("100%_done.txt")).toBe("100%_done.txt");
  });

  it("returns the original name for truncated percent sequences", () => {
    expect(displayName("file%2")).toBe("file%2");
  });
});

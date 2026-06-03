import { describe, expect, it } from "vitest";
import { replaceTaskMarkerAtSourceLine } from "./taskCheckboxSource";

describe("replaceTaskMarkerAtSourceLine", () => {
  it("toggles task markers after stacked markdown list markers", () => {
    const markdown = [
      "- [ ] First",
      "1. - [ ] Second",
      "- - [x] Third",
      "",
      "- - [ ] Fourth",
    ].join("\n");

    expect(replaceTaskMarkerAtSourceLine(markdown, 2, true)).toBe(
      [
        "- [ ] First",
        "1. - [x] Second",
        "- - [x] Third",
        "",
        "- - [ ] Fourth",
      ].join("\n"),
    );
    expect(replaceTaskMarkerAtSourceLine(markdown, 3, false)).toBe(
      [
        "- [ ] First",
        "1. - [ ] Second",
        "- - [ ] Third",
        "",
        "- - [ ] Fourth",
      ].join("\n"),
    );
    expect(replaceTaskMarkerAtSourceLine(markdown, 5, true)).toBe(
      [
        "- [ ] First",
        "1. - [ ] Second",
        "- - [x] Third",
        "",
        "- - [x] Fourth",
      ].join("\n"),
    );
  });
});

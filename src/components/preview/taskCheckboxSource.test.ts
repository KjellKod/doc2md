import { describe, expect, it } from "vitest";
import {
  replaceTaskMarkerAtSourceLine,
  replaceTaskMarkerByIndex,
} from "./taskCheckboxSource";

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

  // Ordered-task regression guard (arb-it1-1): the list path must keep
  // toggling ordered markers `1) [ ]` and `1. [ ]` through the unchanged
  // function, never the table path.
  it("toggles ordered task markers through the unchanged list path", () => {
    const markdown = ["1) [ ] paren ordered", "2. [x] dot ordered"].join("\n");

    expect(replaceTaskMarkerAtSourceLine(markdown, 1, true)).toBe(
      ["1) [x] paren ordered", "2. [x] dot ordered"].join("\n"),
    );
    expect(replaceTaskMarkerAtSourceLine(markdown, 2, false)).toBe(
      ["1) [ ] paren ordered", "2. [ ] dot ordered"].join("\n"),
    );
  });
});

describe("replaceTaskMarkerByIndex", () => {
  it("toggles a single table-cell marker and preserves the rest of the line", () => {
    const markdown = [
      "| MARKED | Name |",
      "| --- | --- |",
      "| - [ ] | Kjell |",
    ].join("\n");

    expect(replaceTaskMarkerByIndex(markdown, 3, 0, true)).toBe(
      ["| MARKED | Name |", "| --- | --- |", "| - [x] | Kjell |"].join("\n"),
    );
  });

  it("toggles only the middle real marker among three reals plus decoys", () => {
    // One source row with three real checkboxes plus a link label, inline code,
    // and an escaped marker. Toggling the MIDDLE real (markerIndex 1) must
    // change only that span; the other reals and every decoy stay byte-identical
    // (plan §6 confidence test).
    const row = "| - [ ] | [x] | - [ ] | [x](url) | `[ ]` | \\[ \\] |";
    const markdown = ["| h |", "| --- |", row].join("\n");

    const toggled = replaceTaskMarkerByIndex(markdown, 3, 1, false);
    expect(toggled).toBe(
      [
        "| h |",
        "| --- |",
        "| - [ ] | [ ] | - [ ] | [x](url) | `[ ]` | \\[ \\] |",
      ].join("\n"),
    );
  });

  it("keeps aligned indices for mixed bare and bulleted reals in one row", () => {
    const row = "| [ ] | - [x] | [X] |";
    const markdown = ["| a | b | c |", "| --- | --- | --- |", row].join("\n");

    // Toggle the last real (index 2) off.
    expect(replaceTaskMarkerByIndex(markdown, 3, 2, false)).toBe(
      ["| a | b | c |", "| --- | --- | --- |", "| [ ] | - [x] | [ ] |"].join(
        "\n",
      ),
    );
  });

  it("is a no-op for an out-of-range markerIndex (arb-it1-3)", () => {
    const markdown = ["| a |", "| --- |", "| - [ ] |"].join("\n");
    expect(replaceTaskMarkerByIndex(markdown, 3, 9, true)).toBe(markdown);
  });

  it("is a no-op when the source line does not exist", () => {
    const markdown = ["| a |", "| --- |", "| - [ ] |"].join("\n");
    expect(replaceTaskMarkerByIndex(markdown, 99, 0, true)).toBe(markdown);
  });
});

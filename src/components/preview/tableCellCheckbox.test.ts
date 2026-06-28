import { describe, expect, it } from "vitest";
import {
  enumerateRowMarkers,
  recognizeCellMarker,
  toggleRowMarkerByIndex,
} from "./tableCellCheckbox";

describe("recognizeCellMarker", () => {
  it("recognizes bare whole-cell markers with state and offsets", () => {
    expect(recognizeCellMarker("[ ]")).toEqual({
      state: "unchecked",
      lineOffsetStart: 0,
      lineOffsetEnd: 3,
    });
    expect(recognizeCellMarker("[x]")).toEqual({
      state: "checked",
      lineOffsetStart: 0,
      lineOffsetEnd: 3,
    });
    expect(recognizeCellMarker("[X]")).toEqual({
      state: "checked",
      lineOffsetStart: 0,
      lineOffsetEnd: 3,
    });
  });

  it("recognizes bare markers padded with cell whitespace and reports absolute offsets", () => {
    expect(recognizeCellMarker("  [x] ")).toEqual({
      state: "checked",
      lineOffsetStart: 2,
      lineOffsetEnd: 5,
    });
  });

  it("recognizes bulleted markers at cell start with and without a trailing label", () => {
    expect(recognizeCellMarker("- [ ]")).toEqual({
      state: "unchecked",
      lineOffsetStart: 2,
      lineOffsetEnd: 5,
    });
    expect(recognizeCellMarker("* [x] Done")).toEqual({
      state: "checked",
      lineOffsetStart: 2,
      lineOffsetEnd: 5,
    });
    expect(recognizeCellMarker("+ [X] Ship it")).toEqual({
      state: "checked",
      lineOffsetStart: 2,
      lineOffsetEnd: 5,
    });
  });

  it("does NOT recognize escaped brackets (BLOCKER 2 guard)", () => {
    expect(recognizeCellMarker("\\[ \\]")).toBeNull();
    expect(recognizeCellMarker("- \\[ \\]")).toBeNull();
  });

  it("does NOT recognize bare markers embedded in prose", () => {
    expect(recognizeCellMarker("done [x] yes")).toBeNull();
    expect(recognizeCellMarker("[x] trailing")).toBeNull();
  });

  it("recognizes only the leading marker; a second marker in the cell stays literal", () => {
    // The bulleted leading marker converts; the second `[ ]` is part of the
    // preserved trailing label and is never recognized as its own marker.
    expect(recognizeCellMarker("- [x] then [ ] later")).toEqual({
      state: "checked",
      lineOffsetStart: 2,
      lineOffsetEnd: 5,
    });
  });

  it("does NOT recognize link labels or inline-code markers", () => {
    expect(recognizeCellMarker("[x](https://example.com)")).toBeNull();
    expect(recognizeCellMarker("`[ ]`")).toBeNull();
  });
});

describe("enumerateRowMarkers", () => {
  it("returns only real markers with correct cell/marker indices and offsets", () => {
    const line = "| - [ ] | Kjell | - [x] |";
    const { markers, rawCellCount } = enumerateRowMarkers(line);

    expect(rawCellCount).toBe(3);
    expect(markers).toHaveLength(2);

    expect(markers[0].cellIndex).toBe(0);
    expect(markers[0].markerIndex).toBe(0);
    expect(markers[0].state).toBe("unchecked");
    expect(line.slice(markers[0].lineOffsetStart, markers[0].lineOffsetEnd)).toBe(
      "[ ]",
    );

    expect(markers[1].cellIndex).toBe(2);
    expect(markers[1].markerIndex).toBe(1);
    expect(markers[1].state).toBe("checked");
    expect(line.slice(markers[1].lineOffsetStart, markers[1].lineOffsetEnd)).toBe(
      "[x]",
    );
  });

  it("ignores decoy cells (escaped, link, inline code, prose) while keeping real indices", () => {
    const line = "| - [ ] | \\[ \\] | [x](url) | `[ ]` | done [x] | - [x] |";
    const { markers } = enumerateRowMarkers(line);

    expect(markers.map((m) => m.markerIndex)).toEqual([0, 1]);
    expect(markers.map((m) => m.cellIndex)).toEqual([0, 5]);
    expect(markers.map((m) => m.state)).toEqual(["unchecked", "checked"]);
  });

  it("does not treat an escaped pipe as a cell boundary", () => {
    const line = "| a \\| b | - [x] |";
    const { markers, rawCellCount } = enumerateRowMarkers(line);
    expect(rawCellCount).toBe(2);
    expect(markers).toHaveLength(1);
    expect(markers[0].cellIndex).toBe(1);
  });

  it("over-counts cells when a pipe lives inside inline code (caught by the fail-safe)", () => {
    // Raw split sees `a`, `b` as two cells; remark-gfm keeps `` `a|b` `` as one
    // cell. The mismatch is what the synthesis plugin's raw-vs-DOM count
    // fail-safe detects to skip the row.
    const line = "| `a|b` | - [x] |";
    const { rawCellCount } = enumerateRowMarkers(line);
    expect(rawCellCount).toBe(3);
  });

  it("keeps aligned indices for mixed bare and bulleted real markers", () => {
    const line = "| [ ] | - [x] | [X] |";
    const { markers } = enumerateRowMarkers(line);
    expect(markers.map((m) => m.markerIndex)).toEqual([0, 1, 2]);
    expect(markers.map((m) => m.state)).toEqual([
      "unchecked",
      "checked",
      "checked",
    ]);
  });
});

describe("toggleRowMarkerByIndex", () => {
  it("flips only the targeted marker span and round-trips with enumerateRowMarkers", () => {
    const line = "| - [ ] | Kjell | - [x] |";
    const toggled = toggleRowMarkerByIndex(line, 0, true);
    expect(toggled).toBe("| - [x] | Kjell | - [x] |");

    const { markers } = enumerateRowMarkers(toggled);
    expect(markers[0].state).toBe("checked");
    expect(markers[1].state).toBe("checked");

    // Round-trip back.
    expect(toggleRowMarkerByIndex(toggled, 0, false)).toBe(line);
  });

  it("toggles the middle real marker among reals plus decoys, byte-for-byte", () => {
    const line =
      "| - [ ] | [x] | - [ ] | [x](url) | `[ ]` | \\[ \\] |";
    // Reals are markerIndex 0,1,2 -> middle is index 1.
    const toggled = toggleRowMarkerByIndex(line, 1, false);
    expect(toggled).toBe(
      "| - [ ] | [ ] | - [ ] | [x](url) | `[ ]` | \\[ \\] |",
    );
  });

  it("returns the line unchanged for an out-of-range markerIndex (arb-it1-3)", () => {
    const line = "| - [ ] | text |";
    expect(toggleRowMarkerByIndex(line, 5, true)).toBe(line);
    expect(toggleRowMarkerByIndex(line, -1, true)).toBe(line);
    expect(toggleRowMarkerByIndex(line, 1.5 as number, true)).toBe(line);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeAutoContinueEdit,
  detectIndentUnit,
  parseLineMarker,
} from "../markdownAutoContinue";

function caretFor(text: string, marker = "|"): { value: string; caretPos: number } {
  const caretPos = text.indexOf(marker);
  if (caretPos === -1) {
    throw new Error(`caret marker ${marker} not found`);
  }
  return { value: text.slice(0, caretPos) + text.slice(caretPos + 1), caretPos };
}

describe("detectIndentUnit", () => {
  it("returns 2 spaces for an empty document", () => {
    expect(detectIndentUnit("")).toBe("  ");
  });

  it("returns 2 spaces when no indented line exists", () => {
    expect(detectIndentUnit("foo\nbar\n")).toBe("  ");
  });

  it("detects a 2-space indent from the first indented line", () => {
    expect(detectIndentUnit("foo\n  bar\n    baz\n")).toBe("  ");
  });

  it("detects a 4-space indent from the first indented line", () => {
    expect(detectIndentUnit("foo\n    bar\n")).toBe("    ");
  });

  it("detects a tab indent", () => {
    expect(detectIndentUnit("foo\n\tbar\n")).toBe("\t");
  });

  it("skips blank lines when looking for indent", () => {
    expect(detectIndentUnit("\n\n  foo\n")).toBe("  ");
  });
});

describe("parseLineMarker", () => {
  it.each([
    ["- foo", "bullet", "-", false],
    ["* foo", "bullet", "*", false],
    ["+ foo", "bullet", "+", false],
    ["- ", "bullet", "-", true],
    ["* ", "bullet", "*", true],
  ])("parses unordered bullet %s", (line, kind, bullet, empty) => {
    const marker = parseLineMarker(line, line.length);
    expect(marker).not.toBeNull();
    expect(marker!.kind).toBe(kind);
    expect(marker!.bulletChar).toBe(bullet);
    expect(marker!.isEmpty).toBe(empty);
  });

  it("parses ordered list with content", () => {
    const marker = parseLineMarker("1. foo", 6);
    expect(marker).toEqual(
      expect.objectContaining({
        kind: "ordered",
        orderedNumber: 1,
        isEmpty: false,
      }),
    );
  });

  it("parses ordered list empty marker", () => {
    const marker = parseLineMarker("3. ", 3);
    expect(marker).toEqual(
      expect.objectContaining({
        kind: "ordered",
        orderedNumber: 3,
        isEmpty: true,
      }),
    );
  });

  it("parses blockquote with content", () => {
    const marker = parseLineMarker("> foo", 5);
    expect(marker).toEqual(
      expect.objectContaining({
        kind: "blockquote",
        isEmpty: false,
      }),
    );
  });

  it("parses unchecked task list", () => {
    const marker = parseLineMarker("- [ ] foo", 9);
    expect(marker).toEqual(
      expect.objectContaining({
        kind: "task-unchecked",
        isEmpty: false,
      }),
    );
  });

  it("parses checked task list", () => {
    const marker = parseLineMarker("- [x] foo", 9);
    expect(marker).toEqual(
      expect.objectContaining({
        kind: "task-checked",
        isEmpty: false,
      }),
    );
  });

  it("returns null for non-list lines", () => {
    expect(parseLineMarker("hello world", 5)).toBeNull();
  });

  it("preserves leading indentation", () => {
    const marker = parseLineMarker("  - foo", 7);
    expect(marker?.indent).toBe("  ");
  });
});

describe("computeAutoContinueEdit", () => {
  it("inserts a new bullet on Enter at end of bullet line", () => {
    const { value, caretPos } = caretFor("- foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit).not.toBeNull();
    expect(edit!.value).toBe("- foo\n- ");
    expect(edit!.caretPos).toBe(edit!.value.length);
  });

  it("inserts a new task marker as unchecked even if source is checked", () => {
    const { value, caretPos } = caretFor("- [x] foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit?.value).toBe("- [x] foo\n- [ ] ");
  });

  it("auto-increments ordered list numbers", () => {
    const { value, caretPos } = caretFor("2. foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit?.value).toBe("2. foo\n3. ");
  });

  it("preserves leading indentation", () => {
    const { value, caretPos } = caretFor("    - foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit?.value).toBe("    - foo\n    - ");
  });

  it("preserves tab indentation", () => {
    const { value, caretPos } = caretFor("\t- foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit?.value).toBe("\t- foo\n\t- ");
  });

  it("continues blockquote", () => {
    const { value, caretPos } = caretFor("> foo|");
    const edit = computeAutoContinueEdit(value, caretPos);
    expect(edit?.value).toBe("> foo\n> ");
  });

  it("exits the list when caret is on an empty bullet", () => {
    const value = "- ";
    const edit = computeAutoContinueEdit(value, value.length);
    expect(edit).not.toBeNull();
    expect(edit!.value).toBe("");
    expect(edit!.caretPos).toBe(0);
  });

  it("exits when caret is on an empty ordered marker", () => {
    const value = "first\n2. ";
    const edit = computeAutoContinueEdit(value, value.length);
    expect(edit?.value).toBe("first\n");
    expect(edit?.caretPos).toBe(6);
  });

  it("exits when caret is on an empty task marker", () => {
    const value = "- [ ] ";
    const edit = computeAutoContinueEdit(value, value.length);
    expect(edit?.value).toBe("");
  });

  it("returns null when caret is on a non-list line", () => {
    const value = "plain text";
    expect(computeAutoContinueEdit(value, value.length)).toBeNull();
  });

  it("returns null when selection crosses a newline", () => {
    const value = "- foo\nbar";
    const edit = computeAutoContinueEdit(value, 0, value.length);
    expect(edit).toBeNull();
  });

  it("inserts continuation when caret is in the middle of the content line", () => {
    const value = "- foobar";
    const edit = computeAutoContinueEdit(value, 5);
    expect(edit?.value).toBe("- foo\n- bar");
  });

  it("handles same-line selection by replacing it with newline + marker", () => {
    const value = "- foobar";
    const edit = computeAutoContinueEdit(value, 5, 8);
    expect(edit?.value).toBe("- foo\n- ");
  });
});

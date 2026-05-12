import { describe, expect, it } from "vitest";
import {
  insertLink,
  smartWrapInsert,
  toggleListLine,
  wrapSelection,
} from "../markdownFormatting";

describe("wrapSelection", () => {
  it("wraps selection with bold markers", () => {
    const edit = wrapSelection("hello world", 6, 11, "**");
    expect(edit.value).toBe("hello **world**");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("world");
  });

  it("unwraps selection that already contains markers", () => {
    const edit = wrapSelection("hello **world**", 6, 15, "**");
    expect(edit.value).toBe("hello world");
  });

  it("unwraps when markers sit immediately outside the selection", () => {
    const edit = wrapSelection("hello **world**", 8, 13, "**");
    expect(edit.value).toBe("hello world");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("world");
  });

  it("inserts paired markers on a caret-only edit", () => {
    const edit = wrapSelection("hello ", 6, 6, "**");
    expect(edit.value).toBe("hello ****");
    expect(edit.selectionStart).toBe(8);
    expect(edit.selectionEnd).toBe(8);
  });

  it("wraps with italic underscore", () => {
    const edit = wrapSelection("foo", 0, 3, "_");
    expect(edit.value).toBe("_foo_");
  });
});

describe("insertLink", () => {
  it("wraps a non-empty selection with link syntax and selects the placeholder", () => {
    const edit = insertLink("read more here", 10, 14);
    expect(edit.value).toBe("read more [here](url)");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("url");
  });

  it("treats a URL selection as the href and selects the link text", () => {
    const url = "https://example.com";
    const value = `prefix ${url}`;
    const edit = insertLink(value, 7, value.length);
    expect(edit.value).toBe(`prefix [link text](${url})`);
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe(
      "link text",
    );
  });

  it("inserts an empty link skeleton at caret", () => {
    const edit = insertLink("hi", 2, 2);
    expect(edit.value).toBe("hi[](url)");
    expect(edit.selectionStart).toBe(3);
    expect(edit.selectionEnd).toBe(3);
  });
});

describe("smartWrapInsert", () => {
  it("wraps selection with backticks for inline code", () => {
    const edit = smartWrapInsert("type foo here", 5, 8, "`");
    expect(edit?.value).toBe("type `foo` here");
  });

  it("wraps with bracket/paren pairs", () => {
    expect(smartWrapInsert("see foo bar", 4, 7, "[")?.value).toBe("see [foo] bar");
    expect(smartWrapInsert("see foo bar", 4, 7, "(")?.value).toBe("see (foo) bar");
    expect(smartWrapInsert("say foo bar", 4, 7, '"')?.value).toBe('say "foo" bar');
  });

  it("returns null for unknown wrap chars", () => {
    expect(smartWrapInsert("abc", 0, 3, "x")).toBeNull();
  });

  it("returns null when there is no selection", () => {
    expect(smartWrapInsert("abc", 1, 1, "*")).toBeNull();
  });
});

describe("toggleListLine", () => {
  it("converts a plain paragraph into an unordered list", () => {
    const edit = toggleListLine("first\nsecond", 0, 12, "unordered");
    expect(edit.value).toBe("- first\n- second");
  });

  it("toggles unordered list off when every line already has it", () => {
    const edit = toggleListLine("- first\n- second", 0, 16, "unordered");
    expect(edit.value).toBe("first\nsecond");
  });

  it("converts to ordered list with incrementing numbers", () => {
    const edit = toggleListLine("alpha\nbeta\ngamma", 0, 16, "ordered");
    expect(edit.value).toBe("1. alpha\n2. beta\n3. gamma");
  });

  it("converts to task list", () => {
    const edit = toggleListLine("buy milk", 0, 8, "task");
    expect(edit.value).toBe("- [ ] buy milk");
  });

  it("preserves leading indentation when adding a list marker", () => {
    const edit = toggleListLine("  indent\n  other", 0, 16, "unordered");
    expect(edit.value).toBe("  - indent\n  - other");
  });
});

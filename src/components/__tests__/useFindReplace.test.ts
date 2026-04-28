import { describe, expect, it } from "vitest";
import {
  MAX_MATCHES,
  applyReplaceAll,
  applyReplaceCurrent,
  findMatches,
} from "../useFindReplace";

describe("findMatches", () => {
  it("returns an empty result for an empty query", () => {
    expect(
      findMatches("alpha beta", "", { regex: false, caseSensitive: false }),
    ).toEqual({ matches: [], total: 0, capped: false, error: null });
  });

  it("finds literal matches case-insensitively by default", () => {
    const result = findMatches("Hello hello", "hello", {
      regex: false,
      caseSensitive: false,
    });

    expect(result.matches).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
    ]);
    expect(result.total).toBe(2);
  });

  it("supports case-sensitive literal search", () => {
    const result = findMatches("Hello hello", "hello", {
      regex: false,
      caseSensitive: true,
    });

    expect(result.matches).toEqual([{ start: 6, end: 11 }]);
  });

  it("caps the navigable match list", () => {
    const result = findMatches("a".repeat(12_000), "a", {
      regex: false,
      caseSensitive: false,
    });

    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.total).toBe(MAX_MATCHES);
    expect(result.capped).toBe(true);
  });

  it("uses multiline regex flags by default", () => {
    const result = findMatches("# A\n# B\n## C", "^#", {
      regex: true,
      caseSensitive: true,
    });

    expect(result.matches).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
      { start: 8, end: 9 },
    ]);
  });

  it("handles zero-width regex matches without treating them as invalid", () => {
    expect(
      findMatches("aaa b", "a*", { regex: true, caseSensitive: true }).error,
    ).toBeNull();
    expect(
      findMatches("a\nb\nc", "^", { regex: true, caseSensitive: true })
        .matches,
    ).toEqual([
      { start: 0, end: 0 },
      { start: 2, end: 2 },
      { start: 4, end: 4 },
    ]);
    expect(
      findMatches("baab", "(?=a)", { regex: true, caseSensitive: true })
        .matches,
    ).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ]);
  });

  it("reports invalid regex without throwing", () => {
    expect(findMatches("abc", "[", { regex: true, caseSensitive: true })).toEqual(
      {
        matches: [],
        total: 0,
        capped: false,
        error: "Invalid regex",
      },
    );
  });

  it("adds the case-insensitive regex flag when case sensitivity is off", () => {
    expect(
      findMatches("Cat cat", "cat", { regex: true, caseSensitive: false })
        .matches,
    ).toHaveLength(2);
    expect(
      findMatches("Cat cat", "cat", { regex: true, caseSensitive: true })
        .matches,
    ).toHaveLength(1);
  });
});

describe("replace helpers", () => {
  it("replaces only the current match", () => {
    expect(
      applyReplaceCurrent(
        "one two one",
        { start: 8, end: 11 },
        "three",
      ),
    ).toEqual({ next: "one two three", delta: 2 });
  });

  it("replaces all literal matches beyond the navigation cap", () => {
    const result = applyReplaceAll("a".repeat(12_000), "a", "b", {
      regex: false,
      caseSensitive: false,
    });

    expect(result.replaced).toBe(12_000);
    expect(result.next).toBe("b".repeat(12_000));
  });

  it("replaces all regex matches with replacement templates", () => {
    const result = applyReplaceAll("A1\nB2", "^([A-Z])(\\d)$", "$2-$1", {
      regex: true,
      caseSensitive: true,
    });

    expect(result).toEqual({
      next: "1-A\n2-B",
      replaced: 2,
      error: null,
    });
  });

  it("leaves source untouched for invalid regex replace all", () => {
    expect(
      applyReplaceAll("abc", "[", "x", {
        regex: true,
        caseSensitive: false,
      }),
    ).toEqual({ next: "abc", replaced: 0, error: "Invalid regex" });
  });
});

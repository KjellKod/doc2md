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
      expect.objectContaining({ start: 0, end: 1 }),
      expect.objectContaining({ start: 4, end: 5 }),
      expect.objectContaining({ start: 8, end: 9 }),
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
      expect.objectContaining({ start: 0, end: 0 }),
      expect.objectContaining({ start: 2, end: 2 }),
      expect.objectContaining({ start: 4, end: 4 }),
    ]);
    expect(
      findMatches("baab", "(?=a)", { regex: true, caseSensitive: true })
        .matches,
    ).toEqual([
      expect.objectContaining({ start: 1, end: 1 }),
      expect.objectContaining({ start: 2, end: 2 }),
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

  it("uses replacement templates for the current regex match", () => {
    const match = findMatches("A1\nB2", "^([A-Z])(\\d)$", {
      regex: true,
      caseSensitive: true,
    }).matches[1];

    expect(
      applyReplaceCurrent("A1\nB2", match, "$2-$1", {
        regex: true,
        caseSensitive: true,
      }),
    ).toEqual({ next: "A1\n2-B", delta: 1 });
  });

  it("keeps replacement templates literal for current literal matches", () => {
    expect(
      applyReplaceCurrent("A1", { start: 0, end: 2 }, "$1", {
        regex: false,
        caseSensitive: true,
      }),
    ).toEqual({ next: "$1", delta: 0 });
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

describe("findMatches with wholeWord", () => {
  it("excludes substring matches when wholeWord is true (plain mode)", () => {
    const result = findMatches("foo foobar foo_bar foo2", "foo", {
      regex: false,
      caseSensitive: true,
      wholeWord: true,
    });
    // "foo" alone matches; "foobar" / "foo_bar" / "foo2" do not because of
    // adjacent word characters (\b uses [A-Za-z0-9_] semantics).
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ start: 0, end: 3 });
  });

  it("matches without wholeWord still find substrings", () => {
    const result = findMatches("foo foobar", "foo", {
      regex: false,
      caseSensitive: true,
      wholeWord: false,
    });
    expect(result.total).toBe(2);
  });

  it("preserves regex alternation with wholeWord", () => {
    const result = findMatches("cat catfish dog dogwood bird", "cat|dog", {
      regex: true,
      caseSensitive: true,
      wholeWord: true,
    });
    // 'cat' at offset 0 and 'dog' at offset 12 match; 'catfish' / 'dogwood'
    // do not because of adjacent word characters.
    expect(result.matches.map((m) => ({ start: m.start, end: m.end, text: m.text }))).toEqual([
      { start: 0, end: 3, text: "cat" },
      { start: 12, end: 15, text: "dog" },
    ]);
  });

  it("combines wholeWord with case-insensitive matching", () => {
    const result = findMatches("Foo foo FOO foobar", "foo", {
      regex: false,
      caseSensitive: false,
      wholeWord: true,
    });
    expect(result.matches).toHaveLength(3);
  });

  it("caps the navigable match list at 5000", () => {
    expect(MAX_MATCHES).toBe(5_000);
    const result = findMatches("a".repeat(7_000), "a", {
      regex: false,
      caseSensitive: true,
    });
    expect(result.capped).toBe(true);
    expect(result.matches).toHaveLength(5_000);
  });
});

describe("applyReplaceAll with wholeWord", () => {
  it("only replaces whole-word matches", () => {
    const result = applyReplaceAll(
      "foo foobar foo",
      "foo",
      "bar",
      { regex: false, caseSensitive: true, wholeWord: true },
    );
    expect(result.next).toBe("bar foobar bar");
    expect(result.replaced).toBe(2);
  });

  it("treats the replacement as literal text in plain Whole Word mode (no $& expansion)", () => {
    const result = applyReplaceAll(
      "foo foobar foo",
      "foo",
      "$&!",
      { regex: false, caseSensitive: true, wholeWord: true },
    );
    // Plain Whole Word must NOT expand $& to the match; the user typed
    // the literal characters "$&!" so they appear verbatim in the output.
    expect(result.next).toBe("$&! foobar $&!");
    expect(result.replaced).toBe(2);
  });

  it("keeps regex Whole Word replacement-template semantics intact", () => {
    const result = applyReplaceAll(
      "alpha beta alpha",
      "alpha",
      "[$&]",
      { regex: true, caseSensitive: true, wholeWord: true },
    );
    // Genuine regex mode keeps $& expansion — user opted in.
    expect(result.next).toBe("[alpha] beta [alpha]");
    expect(result.replaced).toBe(2);
  });
});

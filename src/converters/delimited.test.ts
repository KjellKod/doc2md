import { describe, expect, it } from "vitest";
import {
  normalizeLineEndings,
  parseDelimitedText,
  renderMarkdownTable
} from "./delimited";

describe("normalizeLineEndings", () => {
  it("normalizes CRLF and CR input to LF", () => {
    expect(normalizeLineEndings("alpha\r\nbeta\rgamma\ndelta")).toBe(
      "alpha\nbeta\ngamma\ndelta"
    );
  });
});

describe("parseDelimitedText", () => {
  it("parses rows with quoted fields and escaped quotes", () => {
    expect(
      parseDelimitedText('name,notes\nJean-Claude,"Dry, but ""useful"""', ",")
    ).toEqual([
      ["name", "notes"],
      ["Jean-Claude", 'Dry, but "useful"']
    ]);
  });

  it("filters empty rows from the parsed result", () => {
    expect(parseDelimitedText("name,role\n\nDexter,Builder\n  ,  ", ",")).toEqual([
      ["name", "role"],
      ["Dexter", "Builder"]
    ]);
  });

  it("throws when quoted fields are left unclosed", () => {
    expect(() => parseDelimitedText('name,notes\nDexter,"unfinished', ",")).toThrow(
      SyntaxError
    );
  });

  it("returns an empty result for empty input", () => {
    expect(parseDelimitedText("", ",")).toEqual([]);
  });
});

describe("renderMarkdownTable", () => {
  it("renders a markdown table with padded rows and escaped pipe characters", () => {
    expect(
      renderMarkdownTable([
        ["Name", "Notes", "Team"],
        ["Jean-Claude", "Dry | useful", "Quest"],
        ["Dexter", "Keeps\nreceipts"]
      ])
    ).toBe(
      "| Name | Notes | Team |\n| --- | --- | --- |\n| Jean-Claude | Dry \\| useful | Quest |\n| Dexter | Keeps<br />receipts |  |"
    );
  });
});

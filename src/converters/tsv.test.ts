import { describe, expect, it } from "vitest";
import { CORRUPT_FILE_MESSAGE, EMPTY_FILE_MESSAGE } from "./messages";
import { convertTsv } from "./tsv";

describe("convertTsv", () => {
  it("converts TSV with headers to a Markdown table", async () => {
    const file = new File(
      ["name\trole\tteam\nJean-Claude\tPlanner\tQuest\nDexter\tBuilder\tQuest"],
      "sample.tsv",
      { type: "text/tab-separated-values" }
    );

    const result = await convertTsv(file);

    expect(result).toEqual({
      markdown:
        "| name | role | team |\n| --- | --- | --- |\n| Jean-Claude | Planner | Quest |\n| Dexter | Builder | Quest |",
      warnings: [],
      status: "success"
    });
  });

  it("handles an empty TSV file", async () => {
    const file = new File([" \n\t"], "empty.tsv", {
      type: "text/tab-separated-values"
    });

    const result = await convertTsv(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [EMPTY_FILE_MESSAGE],
      status: "error"
    });
  });

  it("handles a single-column TSV file", async () => {
    const file = new File(["item\nalpha\nbeta"], "single-column.tsv", {
      type: "text/tab-separated-values"
    });

    const result = await convertTsv(file);

    expect(result).toEqual({
      markdown: "| item |\n| --- |\n| alpha |\n| beta |",
      warnings: [],
      status: "success"
    });
  });

  it("reports malformed TSV input", async () => {
    const file = new File(['name\tnotes\nJean-Claude\t"Unfinished'], "broken.tsv", {
      type: "text/tab-separated-values"
    });

    const result = await convertTsv(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});

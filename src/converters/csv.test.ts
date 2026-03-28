import { describe, expect, it } from "vitest";
import { CORRUPT_FILE_MESSAGE, EMPTY_FILE_MESSAGE } from "./messages";
import { convertCsv } from "./csv";

describe("convertCsv", () => {
  it("converts CSV with headers to a Markdown table", async () => {
    const file = new File(
      ["name,role,team\nJean-Claude,Planner,Quest\nDexter,Builder,Quest"],
      "sample.csv",
      { type: "text/csv" }
    );

    const result = await convertCsv(file);

    expect(result).toEqual({
      markdown:
        "| name | role | team |\n| --- | --- | --- |\n| Jean-Claude | Planner | Quest |\n| Dexter | Builder | Quest |",
      warnings: [],
      status: "success"
    });
  });

  it("handles quoted fields with commas", async () => {
    const file = new File(
      ['name,notes\nJean-Claude,"Dry, but useful"\nDexter,"Fast, but tidy"'],
      "quoted.csv",
      { type: "text/csv" }
    );

    const result = await convertCsv(file);

    expect(result.markdown).toContain("| Jean-Claude | Dry, but useful |");
    expect(result.markdown).toContain("| Dexter | Fast, but tidy |");
    expect(result.status).toBe("success");
  });

  it("handles an empty CSV file", async () => {
    const file = new File(["   \n"], "empty.csv", { type: "text/csv" });

    const result = await convertCsv(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [EMPTY_FILE_MESSAGE],
      status: "error"
    });
  });

  it("handles a single-column CSV file", async () => {
    const file = new File(["item\nalpha\nbeta"], "single-column.csv", {
      type: "text/csv"
    });

    const result = await convertCsv(file);

    expect(result).toEqual({
      markdown: "| item |\n| --- |\n| alpha |\n| beta |",
      warnings: [],
      status: "success"
    });
  });

  it("reports malformed CSV input", async () => {
    const file = new File(['name,notes\nJean-Claude,"Unfinished'], "broken.csv", {
      type: "text/csv"
    });

    const result = await convertCsv(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});

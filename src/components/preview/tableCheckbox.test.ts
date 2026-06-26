import { describe, expect, it } from "vitest";
import { convertTableCellCheckboxes } from "./tableCheckbox";

describe("convertTableCellCheckboxes", () => {
  it("converts an unchecked task-list marker in a table cell to ☐", () => {
    const markdown = [
      "| Marked | Name |",
      "| --- | --- |",
      "| - [ ] | Kjell |",
    ].join("\n");

    expect(convertTableCellCheckboxes(markdown)).toBe(
      ["| Marked | Name |", "| --- | --- |", "| ☐ | Kjell |"].join("\n"),
    );
  });

  it("converts a checked task-list marker (x or X) in a table cell to ☑", () => {
    const markdown = [
      "| Marked | Name |",
      "| --- | --- |",
      "| - [x] | Jane |",
      "| - [X] | Jo |",
    ].join("\n");

    expect(convertTableCellCheckboxes(markdown)).toBe(
      [
        "| Marked | Name |",
        "| --- | --- |",
        "| ☑ | Jane |",
        "| ☑ | Jo |",
      ].join("\n"),
    );
  });

  it("converts a bare bracket marker (no bullet) in a table cell", () => {
    const markdown = ["| A | B |", "| --- | --- |", "| [ ] | [x] |"].join("\n");

    expect(convertTableCellCheckboxes(markdown)).toBe(
      ["| A | B |", "| --- | --- |", "| ☐ | ☑ |"].join("\n"),
    );
  });

  it("keeps a label that follows the checkbox in the cell", () => {
    const markdown = [
      "| Task | Owner |",
      "| --- | --- |",
      "| - [ ] ship it | Kjell |",
    ].join("\n");

    expect(convertTableCellCheckboxes(markdown)).toBe(
      ["| Task | Owner |", "| --- | --- |", "| ☐ ship it | Kjell |"].join(
        "\n",
      ),
    );
  });

  it("leaves a genuine task list (no table) untouched", () => {
    const markdown = ["- [ ] first", "- [x] second"].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not touch checkbox-looking text inside a fenced code block", () => {
    const markdown = [
      "```",
      "| A | B |",
      "| --- | --- |",
      "| - [ ] | x |",
      "```",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not rewrite a Markdown link whose label looks like a checkbox", () => {
    const markdown = [
      "| Link | Note |",
      "| --- | --- |",
      "| [x](https://example.com) | done |",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("leaves the delimiter row alone and handles multiple tables", () => {
    const markdown = [
      "| One |",
      "| --- |",
      "| - [ ] |",
      "",
      "text between",
      "",
      "| Two |",
      "| --- |",
      "| - [x] |",
    ].join("\n");

    expect(convertTableCellCheckboxes(markdown)).toBe(
      [
        "| One |",
        "| --- |",
        "| ☐ |",
        "",
        "text between",
        "",
        "| Two |",
        "| --- |",
        "| ☑ |",
      ].join("\n"),
    );
  });

  it("is a no-op for markdown with no brackets", () => {
    const markdown = "# Title\n\nJust prose.";
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not convert incidental [x] in cell prose (needs a bullet or whole cell)", () => {
    const markdown = [
      "| Key | Action |",
      "| --- | --- |",
      "| Esc | press [x] to close |",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not convert a checkbox marker inside an inline code span in a cell", () => {
    const markdown = [
      "| Syntax | Note |",
      "| --- | --- |",
      "| `- [ ]` | literal example |",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not treat a 4-space indented code block as a table", () => {
    const markdown = [
      "    | Done |",
      "    | --- |",
      "    | - [ ] |",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not treat a bare --- thematic break as a table delimiter", () => {
    const markdown = ["| not a table |", "---", "| - [ ] |"].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });

  it("does not close a longer fence with a shorter backtick run", () => {
    // The inner ``` is content of the ```` fence, so the table stays code.
    const markdown = [
      "````",
      "```",
      "| Done |",
      "| --- |",
      "| - [ ] |",
      "````",
    ].join("\n");
    expect(convertTableCellCheckboxes(markdown)).toBe(markdown);
  });
});

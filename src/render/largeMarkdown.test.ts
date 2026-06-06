import { describe, expect, it } from "vitest";
import { analyzeLargeMarkdown } from "./largeMarkdown";

function largeTableMarkdown(rowCount: number): string {
  const rows = ["# Report", "", "| Package | License | Notes |", "| --- | --- | --- |"];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push(
      `| package-${index} | MIT | ${"metadata ".repeat(8)}${index} |`,
    );
  }
  return rows.join("\n");
}

describe("analyzeLargeMarkdown", () => {
  it("flags large table-heavy Markdown for the guarded large document path", () => {
    const analysis = analyzeLargeMarkdown(largeTableMarkdown(1_100));

    expect(analysis.isLargeMarkdown).toBe(true);
    expect(analysis.isTableHeavy).toBe(true);
    expect(analysis.useFallbackPreview).toBe(true);
    expect(analysis.tableLineCount).toBe(1_102);
    expect(analysis.reason).toContain("Large table-heavy Markdown");
  });

  it("keeps ordinary GFM tables on the rich preview path", () => {
    const analysis = analyzeLargeMarkdown(
      ["| Name | Score |", "| --- | --- |", "| Ada | 10 |"].join("\n"),
    );

    expect(analysis.isLargeMarkdown).toBe(false);
    expect(analysis.isTableHeavy).toBe(false);
    expect(analysis.useFallbackPreview).toBe(false);
  });

  it("does not fallback for large prose without table dominance", () => {
    const analysis = analyzeLargeMarkdown(
      Array.from({ length: 2_200 }, (_, index) => `Paragraph ${index}.`).join(
        "\n",
      ),
    );

    expect(analysis.isLargeMarkdown).toBe(true);
    expect(analysis.isTableHeavy).toBe(false);
    expect(analysis.useFallbackPreview).toBe(false);
  });
});

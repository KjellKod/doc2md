import { describe, expect, it } from "vitest";
import { convertHtmlFragmentToMarkdown } from "./richText";

describe("convertHtmlFragmentToMarkdown", () => {
  it("converts simple html fragments to markdown", () => {
    expect(convertHtmlFragmentToMarkdown("<p>Hello <strong>world</strong>.</p>")).toBe(
      "Hello **world**."
    );
  });

  it("converts tables into markdown tables", () => {
    const markdown = convertHtmlFragmentToMarkdown(
      "<p>Overview</p><table><tr><th>Name</th><th>Role</th></tr><tr><td>Jean-Claude</td><td>Planner</td></tr></table>"
    );

    expect(markdown).toContain("Overview");
    expect(markdown).toContain("| Name | Role |");
    expect(markdown).toContain("| Jean-Claude | Planner |");
  });

  it("restores multiple table placeholders without leaking placeholder markers", () => {
    const markdown = convertHtmlFragmentToMarkdown(
      "<table><tr><th>A</th></tr><tr><td>One</td></tr></table><p>Between</p><table><tr><th>B</th></tr><tr><td>Two</td></tr></table>"
    );

    expect(markdown).toContain("| A |");
    expect(markdown).toContain("| B |");
    expect(markdown).toContain("Between");
    expect(markdown).not.toContain("DOC2MDTABLE");
  });

  it("reconstructs nested Google Docs lists before markdown conversion", () => {
    const markdown = convertHtmlFragmentToMarkdown(
      [
        '<ul class="lst-kix_demo-0"><li>Top level</li></ul>',
        '<ul class="lst-kix_demo-1"><li>Nested item</li></ul>'
      ].join("")
    );

    expect(markdown).toContain("- Top level");
    expect(markdown).toContain("  - Nested item");
  });
});

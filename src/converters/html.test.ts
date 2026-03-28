import { describe, expect, it } from "vitest";
import { convertHtml } from "./html";

describe("convertHtml", () => {
  it("converts headings to ATX-style Markdown", async () => {
    const file = new File(["<h1>Title</h1><p>Body copy.</p>"], "sample.html", {
      type: "text/html"
    });

    const result = await convertHtml(file);

    expect(result.markdown).toContain("# Title");
    expect(result.markdown).toContain("Body copy.");
    expect(result.status).toBe("success");
  });

  it("converts lists to Markdown lists", async () => {
    const file = new File(["<ul><li>First</li><li>Second</li></ul>"], "list.html", {
      type: "text/html"
    });

    const result = await convertHtml(file);

    expect(result.markdown).toContain("- First");
    expect(result.markdown).toContain("- Second");
    expect(result.status).toBe("success");
  });

  it("converts links to Markdown links", async () => {
    const file = new File(
      ['<p><a href="https://example.com/docs">Read the docs</a></p>'],
      "link.html",
      { type: "text/html" }
    );

    const result = await convertHtml(file);

    expect(result.markdown).toContain("[Read the docs](https://example.com/docs)");
    expect(result.status).toBe("success");
  });

  it("converts tables to Markdown tables", async () => {
    const file = new File(
      [
        "<table><tr><th>Name</th><th>Role</th></tr><tr><td>Jean-Claude</td><td>Planner</td></tr></table>"
      ],
      "table.html",
      { type: "text/html" }
    );

    const result = await convertHtml(file);

    expect(result.markdown).toContain("| Name | Role |");
    expect(result.markdown).toContain("| Jean-Claude | Planner |");
    expect(result.status).toBe("success");
  });

  it("handles an empty HTML file", async () => {
    const file = new File(["   "], "empty.html", { type: "text/html" });

    const result = await convertHtml(file);

    expect(result).toEqual({
      markdown: "",
      warnings: ["This HTML file is empty."],
      status: "error"
    });
  });
});

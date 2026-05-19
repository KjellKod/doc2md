import { describe, expect, it } from "vitest";
import {
  convertClipboardPasteToMarkdown,
  convertLinkedInUnicodeToMarkdown,
} from "./pasteToMarkdown";
import { convertLinkedInUnicodeInMarkdown } from "./linkedInUnicode";
import { restorePasteMarkdownPlaceholders } from "./pasteHtmlNormalizer";

describe("convertLinkedInUnicodeToMarkdown", () => {
  it("converts linkedin unicode emphasis to markdown", () => {
    expect(
      convertLinkedInUnicodeToMarkdown(
        "𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐 and 𝑩𝒐𝒍𝒅 𝒊𝒕𝒂𝒍𝒊𝒄 and ℎ",
      ),
    ).toBe("**Bold** and *italic* and ***Bold italic*** and *h*");
  });

  it("converts combining strikethrough and removes underline marks", () => {
    expect(
      convertLinkedInUnicodeToMarkdown("s̶t̶r̶u̶c̶k̶ and u̲n̲d̲e̲r̲"),
    ).toBe("~~struck~~ and under");
  });

  it("composes combining strikethrough with linkedin unicode emphasis", () => {
    expect(
      convertLinkedInUnicodeToMarkdown(
        "𝐁̶𝐨̶𝐥̶𝐝̶ and 𝑖̶𝑡̶𝑎̶𝑙̶𝑖̶𝑐̶ and 𝑩̶𝒐̶𝒍̶𝒅̶ 𝒊̶𝒕̶𝒂̶𝒍̶𝒊̶𝒄̶",
      ),
    ).toBe("**~~Bold~~** and *~~italic~~* and ***~~Bold italic~~***");
  });
});

describe("convertLinkedInUnicodeInMarkdown", () => {
  it("does not treat intraword underscore runs as markdown emphasis", () => {
    expect(convertLinkedInUnicodeInMarkdown("snake_case 𝑖𝑡𝑎𝑙𝑖𝑐")).toBe(
      "snake_case *italic*",
    );
    expect(convertLinkedInUnicodeInMarkdown("a__b__ 𝑖𝑡𝑎𝑙𝑖𝑐")).toBe(
      "a__b__ *italic*",
    );
  });
});

describe("restorePasteMarkdownPlaceholders", () => {
  it("removes only one Markdown escape before unicode dashes", () => {
    expect(
      restorePasteMarkdownPlaceholders("\\— and \\\\— and \\– and \\\\–"),
    ).toBe("— and \\— and – and \\–");
  });
});

describe("convertClipboardPasteToMarkdown", () => {
  it("converts Google Docs-style headings, inline styles, lists, and checkboxes to markdown", () => {
    const googleDocsClipboardHtml = [
      '<meta charset="utf-8">',
      '<p dir="ltr" style="line-height:1.38;margin-top:20pt;margin-bottom:6pt;">',
      '<span style="font-size:20pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700;font-style:normal;white-space:pre-wrap;">Launch Plan</span>',
      "</p>",
      '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">',
      '<span style="font-size:11pt;font-family:Arial;font-weight:700;white-space:pre-wrap;">Bold priority</span>',
      '<span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;"> and </span>',
      '<span style="font-size:11pt;font-family:Arial;font-style:italic;white-space:pre-wrap;">italic detail</span>',
      "</p>",
      "<ul>",
      '<li><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Normal item</span></li>',
      '<li><input type="checkbox" checked><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Done task</span></li>',
      '<li><input type="checkbox"><span style="font-size:11pt;font-family:Arial;white-space:pre-wrap;">Open task</span></li>',
      "</ul>",
    ].join("");

    expect(
      convertClipboardPasteToMarkdown({
        html: googleDocsClipboardHtml,
        plainText: "Launch Plan\nBold priority and italic detail\nNormal item\nDone task\nOpen task",
      }),
    ).toEqual({
      markdown: [
        "# Launch Plan",
        "",
        "**Bold priority** and _italic detail_",
        "",
        "- Normal item",
        "- [x] Done task",
        "- [ ] Open task",
      ].join("\n"),
      source: "html",
    });
  });

  it("renders Google Docs checkbox lists as task lists even when the parent is an <ol>", () => {
    // Google Docs sometimes emits checklists as <ol class="lst-kix_*-N">
    // (e.g. when a numbered list is converted to a checklist or when a
    // mixed section reuses an existing ordered family). The presence of
    // checkbox <img alt="checked|unchecked"> markers inside the items
    // means this is a task list, not a numbered list. Output must use
    // `- [ ]` / `- [x]`, never `1. [ ]` / `2. [ ]`.
    const result = convertClipboardPasteToMarkdown({
      html: [
        '<ol class="lst-kix_x-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>100% completion</span></li>',
        '<li><img alt="checked" src="data:image/png;base64,abc"><span>Done item</span></li>',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>Another item</span></li>',
        "</ol>",
      ].join(""),
      plainText: "100% completion\nDone item\nAnother item",
    });

    expect(result.markdown.split("\n")).toEqual([
      "- [ ] 100% completion",
      "- [x] Done item",
      "- [ ] Another item",
    ]);
    expect(result.markdown).not.toMatch(/^\d+\.\s/m);
  });

  it("keeps a real ordered list as a numbered list when it has no checkbox markers", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<ol>",
        "<li>First step</li>",
        "<li>Second step</li>",
        "<li>Third step</li>",
        "</ol>",
      ].join(""),
      plainText: "First\nSecond\nThird",
    });

    // Turndown's default OL prefix is `N.  ` (two spaces); we don't
    // override it because plain <ol> never gets `data-doc2md-list-level`
    // or `data-doc2md-task-item` annotated, so this falls through to
    // the default rule. The point of this test is that we did NOT
    // accidentally force a bullet marker for non-task ordered lists.
    expect(result.markdown.split("\n")).toEqual([
      "1.  First step",
      "2.  Second step",
      "3.  Third step",
    ]);
  });

  it("converts Google Docs checkbox images without leaking data images or document-wide bold markers", () => {
    const googleDocsClipboardHtml = [
      "<strong>",
      "<h1>Executive Summary Goals to Achieve in Q2</h1>",
      '<p><a href="mailto:art@example.com">Art Messal</a>:</p>',
      "<ul>",
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></li>',
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></li>',
      '<li><img alt="checked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-7952">ONF-7952</a><span> Q1-4c Whitelabel Client Portal</span></li>',
      "</ul>",
      "</strong>",
    ].join("");

    expect(
      convertClipboardPasteToMarkdown({
        html: googleDocsClipboardHtml,
        plainText:
          "Executive Summary Goals to Achieve in Q2\nArt Messal:\n100% completion of five must-do-epics 2026-Q2-100 labels\nONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions\nONF-7952 Q1-4c Whitelabel Client Portal",
      }),
    ).toEqual({
      markdown: [
        "# Executive Summary Goals to Achieve in Q2",
        "",
        "[Art Messal](mailto:art@example.com):",
        "",
        "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
        "- [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
        "- [x] [ONF-7952](https://example.atlassian.net/browse/ONF-7952) Q1-4c Whitelabel Client Portal",
      ].join("\n"),
      source: "html",
    });
  });

  it("keeps Google Docs checkbox item text on the marker line", () => {
    const googleDocsClipboardHtml = [
      "<ul>",
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></p></li>',
      '<li><input type="checkbox"><div><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></div></li>',
      "</ul>",
    ].join("");

    const result = convertClipboardPasteToMarkdown({
      html: googleDocsClipboardHtml,
      plainText:
        "100% completion of five must-do-epics 2026-Q2-100 labels\nONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions",
    });

    expect(result).toEqual({
      markdown: [
        "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
        "- [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
      ].join("\n"),
      source: "html",
    });
    expect(result.markdown).not.toMatch(/^-\s+\[[ xX]\]\s*\n/m);
  });

  it("preserves nested lists after a Google Docs checkbox marker", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<ul>",
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><ul><li>Nested item</li></ul></li>',
        "</ul>",
      ].join(""),
      plainText: "Nested item",
    });

    expect(result).toEqual({
      markdown: ["- [ ]", "    - Nested item"].join("\n"),
      source: "html",
    });
  });

  it("preserves a single Google Docs sibling checkbox nesting level", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        '<ul class="lst-kix_goal-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></p></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></p></li>',
        "</ul>",
        '<ul class="lst-kix_goal-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><a href="https://example.atlassian.net/browse/ONF-7952">ONF-7952</a><span> Q1-4c Whitelabel Client Portal</span></p></li>',
        "</ul>",
      ].join(""),
      plainText:
        "100% completion of five must-do-epics 2026-Q2-100 labels\nONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions\nONF-7952 Q1-4c Whitelabel Client Portal",
    });

    expect(result).toEqual({
      markdown: [
        "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
        "    - [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
        "- [ ] [ONF-7952](https://example.atlassian.net/browse/ONF-7952) Q1-4c Whitelabel Client Portal",
      ].join("\n"),
      source: "html",
    });
  });

  it("keeps ambiguous Google Docs level sequences in original order without deep nesting", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        '<ul class="lst-kix_goal-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-2">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-7952">ONF-7952</a><span> Q1-4c Whitelabel Client Portal</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-6640">ONF-6640</a><span> Q1-2a Custom Fields/Requirements for Courier Clients</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>At least 65% completion of all 12 committed epics</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-10010">ONF-10010</a><span> Q2 revenue reporting</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-10009">ONF-10009</a><span> Q2 driver workflow</span></li>',
        "</ul>",
        '<ul class="lst-kix_goal-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>Continue operational cleanup</span></li>',
        "</ul>",
      ].join(""),
      plainText: [
        "100% completion of five must-do-epics 2026-Q2-100 labels",
        "ONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions",
        "ONF-7952 Q1-4c Whitelabel Client Portal",
        "ONF-6640 Q1-2a Custom Fields/Requirements for Courier Clients",
        "At least 65% completion of all 12 committed epics",
        "ONF-10010 Q2 revenue reporting",
        "ONF-10009 Q2 driver workflow",
        "Continue operational cleanup",
      ].join("\n"),
    });

    expect(result).toEqual({
      markdown: [
        "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
        "    - [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
        "    - [ ] [ONF-7952](https://example.atlassian.net/browse/ONF-7952) Q1-4c Whitelabel Client Portal",
        "    - [ ] [ONF-6640](https://example.atlassian.net/browse/ONF-6640) Q1-2a Custom Fields/Requirements for Courier Clients",
        "- [ ] At least 65% completion of all 12 committed epics",
        "    - [ ] [ONF-10010](https://example.atlassian.net/browse/ONF-10010) Q2 revenue reporting",
        "    - [ ] [ONF-10009](https://example.atlassian.net/browse/ONF-10009) Q2 driver workflow",
        "    - [ ] Continue operational cleanup",
      ].join("\n"),
      source: "html",
    });
  });

  it("caps ambiguous Google Docs li-bullet checkbox indentation at one level", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<ul>",
        '<li class="li-bullet-0"><img alt="unchecked" src="data:image/png;base64,abc"><span>Parent task</span></li>',
        '<li class="li-bullet-1"><img alt="unchecked" src="data:image/png;base64,abc"><span>Child task</span></li>',
        '<li class="li-bullet-2"><img alt="unchecked" src="data:image/png;base64,abc"><span>Grandchild task</span></li>',
        '<li class="li-bullet-1"><img alt="unchecked" src="data:image/png;base64,abc"><span>Second child task</span></li>',
        '<li class="li-bullet-0"><img alt="unchecked" src="data:image/png;base64,abc"><span>Next parent task</span></li>',
        "</ul>",
      ].join(""),
      plainText:
        "Parent task\nChild task\nGrandchild task\nSecond child task\nNext parent task",
    });

    expect(result).toEqual({
      markdown: [
        "- [ ] Parent task",
        "    - [ ] Child task",
        "    - [ ] Grandchild task",
        "    - [ ] Second child task",
        "- [ ] Next parent task",
      ].join("\n"),
      source: "html",
    });
  });

  it("preserves source order when Google Docs batches sibling lst-kix lists by level", () => {
    // Real Google Docs paste batches every top-level bullet into one
    // <ul class="lst-kix_x-0"> and every child into one
    // <ul class="lst-kix_x-1">. The previous algorithm moved the child
    // list under the LAST parent <li>, dumping all children at the end
    // and producing the reorder reported in the bug.
    const result = convertClipboardPasteToMarkdown({
      html: [
        '<ul class="lst-kix_x-0">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></li>',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>At least 65% (eight) completion of all 12 committed epics</span></li>',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>Security Automatic Pipeline</span></li>',
        "</ul>",
        '<ul class="lst-kix_x-1">',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></li>',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-7952">ONF-7952</a><span> Q1-4c Whitelabel Client Portal</span></li>',
        '<li><img alt="unchecked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/DEV-2936">DEV-2936</a><span> Integrate SAST tool with platform</span></li>',
        "</ul>",
      ].join(""),
      plainText:
        "100% completion of five must-do-epics 2026-Q2-100 labels\nAt least 65% (eight) completion of all 12 committed epics\nSecurity Automatic Pipeline\nONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions\nONF-7952 Q1-4c Whitelabel Client Portal\nDEV-2936 Integrate SAST tool with platform",
    });

    // Source DOM order is preserved verbatim. The bug report's specific
    // invariants (ONF-9505 before "At least 65%", "Security..." after
    // DEV-2936) are NOT met by this batched HTML — and they cannot be
    // without reordering DOM nodes, which is exactly the move that
    // caused the original swap bug. Instead we guarantee the items
    // appear in DOM order with no reordering and no false attachment of
    // every child to the final parent.
    const lines = result.markdown.split("\n");
    expect(lines).toEqual([
      "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
      "- [ ] At least 65% (eight) completion of all 12 committed epics",
      "- [ ] Security Automatic Pipeline",
      "    - [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
      "    - [ ] [ONF-7952](https://example.atlassian.net/browse/ONF-7952) Q1-4c Whitelabel Client Portal",
      "    - [ ] [DEV-2936](https://example.atlassian.net/browse/DEV-2936) Integrate SAST tool with platform",
    ]);
    expect(result.source).toBe("html");
  });

  it("preserves the reported plain-text reading order across interleaved Google Docs lists", () => {
    // The user-reported scenario: every top-level bullet has its own
    // children, emitted by Google Docs as alternating sibling lists.
    // ONF-9505 (a child of 100%) must appear BEFORE "At least 65%"
    // (the next parent), and "Security Automatic Pipeline" must appear
    // AFTER DEV-2936 (the last child of "At least 65%"). The previous
    // algorithm reordered items when the same lst-kix family was reused.
    const familyA = "lst-kix_a-";
    const html = [
      `<ul class="${familyA}0">`,
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></li>',
      "</ul>",
      `<ul class="${familyA}1">`,
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>ONF-9505 [EE] Refactor Task Endpoints</span></li>',
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>ONF-7952 Q1-4c Whitelabel Client Portal</span></li>',
      "</ul>",
      `<ul class="${familyA}0">`,
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>At least 65% (eight) completion of all 12 committed epics</span></li>',
      "</ul>",
      `<ul class="${familyA}1">`,
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>ONF-10010 Q2-9 EE refactor task endpoints</span></li>',
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>DEV-2936 Integrate SAST tool with platform</span></li>',
      "</ul>",
      `<ul class="${familyA}0">`,
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><span>Security Automatic Pipeline</span></li>',
      "</ul>",
    ].join("");

    const result = convertClipboardPasteToMarkdown({
      html,
      plainText:
        "100% completion of five must-do-epics 2026-Q2-100 labels\nONF-9505 [EE] Refactor Task Endpoints\nONF-7952 Q1-4c Whitelabel Client Portal\nAt least 65% (eight) completion of all 12 committed epics\nONF-10010 Q2-9 EE refactor task endpoints\nDEV-2936 Integrate SAST tool with platform\nSecurity Automatic Pipeline",
    });

    const md = result.markdown;
    const idx = (needle: string) => {
      const i = md.indexOf(needle);
      expect(i, `expected to find ${needle}`).toBeGreaterThanOrEqual(0);
      return i;
    };

    // The two load-bearing assertions from the bug report.
    expect(idx("ONF-9505")).toBeLessThan(idx("At least 65%"));
    expect(idx("Security Automatic Pipeline")).toBeGreaterThan(
      idx("DEV-2936"),
    );

    // And the full source-order check, with one level of nesting.
    expect(md.split("\n")).toEqual([
      "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
      "    - [ ] ONF-9505 \\[EE\\] Refactor Task Endpoints",
      "    - [ ] ONF-7952 Q1-4c Whitelabel Client Portal",
      "- [ ] At least 65% (eight) completion of all 12 committed epics",
      "    - [ ] ONF-10010 Q2-9 EE refactor task endpoints",
      "    - [ ] DEV-2936 Integrate SAST tool with platform",
      "- [ ] Security Automatic Pipeline",
    ]);
  });

  it("preserves the 0,1,0 nesting pattern for Google Docs task lists", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<ul>",
        '<li class="li-bullet-0"><img alt="unchecked" src="data:image/png;base64,abc"><span>parent</span></li>',
        '<li class="li-bullet-1"><img alt="unchecked" src="data:image/png;base64,abc"><span>child</span></li>',
        '<li class="li-bullet-0"><img alt="unchecked" src="data:image/png;base64,abc"><span>next parent</span></li>',
        "</ul>",
      ].join(""),
      plainText: "parent\nchild\nnext parent",
    });

    expect(result.markdown.split("\n")).toEqual([
      "- [ ] parent",
      "    - [ ] child",
      "- [ ] next parent",
    ]);
  });

  it("does not reorder items or deep-nest under the 0,1,2,1,0,1,1,1 sequence", () => {
    const labels = [
      "L0-parent-A",
      "L1-childA1",
      "L2-childA1a",
      "L1-childA2",
      "L0-parent-B",
      "L1-childB1",
      "L1-childB2",
      "L1-childB3",
    ];
    const levels = [0, 1, 2, 1, 0, 1, 1, 1];

    const html = [
      "<ul>",
      ...labels.map(
        (label, index) =>
          `<li class="li-bullet-${levels[index]}"><img alt="unchecked" src="data:image/png;base64,abc"><span>${label}</span></li>`,
      ),
      "</ul>",
    ].join("");

    const result = convertClipboardPasteToMarkdown({
      html,
      plainText: labels.join("\n"),
    });

    const lines = result.markdown.split("\n");

    // Items appear in source order.
    expect(lines.map((line) => line.replace(/^\s*[-]\s+\[[ xX]\]\s+/, "")))
      .toEqual(labels);

    // No item is indented deeper than one level (maxGoogleDocsInferredListDepth=1).
    lines.forEach((line) => {
      const leading = line.match(/^ */)?.[0] ?? "";
      expect(leading.length).toBeLessThanOrEqual(4);
    });

    // Specifically: A2 must follow A1a (no reorder), and B1 must follow B (parent B's child).
    expect(lines).toEqual([
      "- [ ] L0-parent-A",
      "    - [ ] L1-childA1",
      "    - [ ] L2-childA1a",
      "    - [ ] L1-childA2",
      "- [ ] L0-parent-B",
      "    - [ ] L1-childB1",
      "    - [ ] L1-childB2",
      "    - [ ] L1-childB3",
    ]);
  });

  it("preserves a single Google Docs checkbox nesting level from copied css margin classes", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<style>",
        ".top{margin-left:36pt}.nested{margin-left:72pt}",
        "</style>",
        "<ul>",
        '<li class="top"><img alt="unchecked" src="data:image/png;base64,abc"><span>Parent task</span></li>',
        '<li class="nested"><img alt="unchecked" src="data:image/png;base64,abc"><span>Child task</span></li>',
        '<li class="top"><img alt="unchecked" src="data:image/png;base64,abc"><span>Next parent task</span></li>',
        "</ul>",
      ].join(""),
      plainText: "Parent task\nChild task\nNext parent task",
    });

    expect(result).toEqual({
      markdown: [
        "- [ ] Parent task",
        "    - [ ] Child task",
        "- [ ] Next parent task",
      ].join("\n"),
      source: "html",
    });
  });

  it("converts common sans-serif LinkedIn unicode emphasis to markdown", () => {
    expect(
      convertClipboardPasteToMarkdown({
        html: "",
        plainText: "𝗕𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤",
      }),
    ).toEqual({
      markdown: "**Bold** and *italic*",
      source: "plainText",
    });
  });

  it("prefers basic html clipboard content when conversion is non-empty", () => {
    const result = convertClipboardPasteToMarkdown({
      html: [
        "<h2>Heading</h2>",
        "<p><strong>Bold</strong> and <em>italic</em> with ",
        '<a href="https://example.com">a link</a>.</p>',
        "<ul><li>One</li><li>Two</li></ul>",
        "<ol><li>First</li><li>Second</li></ol>",
      ].join(""),
      plainText: "Plain fallback",
    });

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("## Heading");
    expect(result.markdown).toContain("**Bold**");
    expect(result.markdown).toContain("_italic_");
    expect(result.markdown).toContain("[a link](https://example.com)");
    expect(result.markdown).toContain("- One");
    expect(result.markdown).toMatch(/1\.\s+First/);
  });

  it("passes unicode dashes through verbatim when html is just a wrapper", () => {
    // The HTML adds no formatting beyond wrapping the dashes in a <p>,
    // so the trivial-wrapper heuristic routes to the plain-text path
    // and the user gets the exact characters they copied.
    expect(
      convertClipboardPasteToMarkdown({
        html: "<p>— and –</p>",
        plainText: "— and –",
      }),
    ).toEqual({
      markdown: "— and –",
      source: "plainText",
    });
  });

  it("passes literal ascii horizontal-rule markers through verbatim when html is just a wrapper", () => {
    // The HTML adds no formatting. The user copied literal `---` and
    // we respect that — markdown will interpret it as an HR if rendered.
    // The escape-to-`\\---` behavior only applies when Google Docs has
    // auto-substituted dashes (html and plain text disagree); see the
    // next test.
    expect(
      convertClipboardPasteToMarkdown({
        html: "<p>---</p>",
        plainText: "---",
      }),
    ).toEqual({
      markdown: "---",
      source: "plainText",
    });
  });

  it("uses the plain text marker when Google Docs html auto-substitutes dashes", () => {
    // Plain text disagrees with HTML text (`---` vs `—`), so the
    // wrapper heuristic does not fire and the HTML path runs with its
    // dash-restoration logic.
    expect(
      convertClipboardPasteToMarkdown({
        html: "<p>—</p>",
        plainText: "---",
      }),
    ).toEqual({
      markdown: "\\---",
      source: "html",
    });
  });

  it("passes a standalone em dash through verbatim when html and plain text agree", () => {
    // Both clipboard payloads contain `—`. The user really did copy an
    // em dash, so we don't try to second-guess and restore it as
    // `\\---`. The escape-to-`\\---` behavior only fires when the HTML
    // says `—` but the plain text says `---` (the auto-substitution
    // case above).
    expect(
      convertClipboardPasteToMarkdown({
        html: "<p>—</p>",
        plainText: "—",
      }),
    ).toEqual({
      markdown: "—",
      source: "plainText",
    });
  });

  it("converts linkedin unicode inside html clipboard content", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p>𝐁𝐨𝐥𝐝 and 𝑖𝑡𝑎𝑙𝑖𝑐</p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "**Bold** and *italic*",
      source: "html",
    });
  });

  it("does not duplicate markdown markers for unicode inside semantic html", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p><strong>𝐁𝐨𝐥𝐝</strong> and <em>𝑖𝑡𝑎𝑙𝑖𝑐</em></p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "**Bold** and _italic_",
      source: "html",
    });
  });

  it("composes combining strikethrough with semantic html emphasis", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p><strong>𝐁̶𝐨̶𝐥̶𝐝̶</strong> and <em>𝑖̶𝑡̶𝑎̶𝑙̶𝑖̶𝑐̶</em></p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "**~~Bold~~** and _~~italic~~_",
      source: "html",
    });
  });

  it("does not treat underscores in html link destinations as markdown emphasis", () => {
    const result = convertClipboardPasteToMarkdown({
      html: '<p><a href="https://example.com/a_b">link</a> 𝑖𝑡𝑎𝑙𝑖𝑐</p>',
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "[link](https://example.com/a_b) *italic*",
      source: "html",
    });
  });

  it("does not treat intraword underscores as markdown emphasis", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p>snake_case 𝑖𝑡𝑎𝑙𝑖𝑐</p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "snake\\_case *italic*",
      source: "html",
    });
  });

  it("does not convert unicode inside multi-backtick html code spans", () => {
    const result = convertClipboardPasteToMarkdown({
      html: "<p><code>`𝐁𝐨𝐥𝐝`</code> 𝑖𝑡𝑎𝑙𝑖𝑐</p>",
      plainText: "Plain fallback",
    });

    expect(result).toEqual({
      markdown: "`` `𝐁𝐨𝐥𝐝` `` *italic*",
      source: "html",
    });
  });

  it("falls back to plain text when html conversion is empty", () => {
    expect(
      convertClipboardPasteToMarkdown({
        html: "<span>   </span>",
        plainText: "𝐁𝐨𝐥𝐝 fallback",
      }),
    ).toEqual({
      markdown: "**Bold** fallback",
      source: "plainText",
    });
  });

  it("treats trivial Gmail-style div-per-line html as a plain-text wrapper", () => {
    // Gmail wraps each visible line in a <div>, even after the user
    // selects "remove formatting". When the source the user copied was
    // itself markdown, the HTML's textContent matches the plain-text
    // payload exactly and the HTML carries zero structural meaning.
    // Routing it through Turndown escapes every markdown character in
    // text nodes (#, **, `, _, [, ]) and corrupts the paste. Prefer the
    // plain-text payload instead.
    const plainText = [
      "# Battery Alert for macOS",
      "",
      "A small Automator app that polls your battery level.",
      "",
      "## Setup",
      "",
      "1. Open **Automator**.",
      "2. Save it as `Battery Alert.app`.",
      "",
      "```applescript",
      'set batteryInfo to do shell script "pmset -g batt"',
      "```",
      "",
      "- **20%** — low battery warning",
      "- **10%** — critical battery warning",
    ].join("\n");

    const gmailWrappedHtml = plainText
      .split("\n")
      .map((line) => (line.length === 0 ? "<div><br></div>" : `<div>${line}</div>`))
      .join("");

    expect(
      convertClipboardPasteToMarkdown({
        html: gmailWrappedHtml,
        plainText,
      }),
    ).toEqual({
      markdown: plainText,
      source: "plainText",
    });
  });

  it("does not route through the trivial wrapper path when html carries real formatting", () => {
    // Same plain text as the Gmail case, but the HTML now contains a
    // <strong> element, so the user really did copy something with rich
    // formatting and we should respect Turndown's output.
    const result = convertClipboardPasteToMarkdown({
      html: "<div>Plain line</div><div><strong>Bold line</strong></div>",
      plainText: "Plain line\nBold line",
    });

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("**Bold line**");
  });

  it("does not route through the trivial wrapper path when html injects characters not in plain text", () => {
    // The HTML carries different characters from plain text (Google
    // Docs auto-substituted the ascii dashes with a unicode em dash).
    // Since the payloads disagree on content, the wrapper heuristic
    // does not fire and the HTML conversion path runs.
    const result = convertClipboardPasteToMarkdown({
      html: "<div>Word — another</div>",
      plainText: "Word -- another",
    });

    expect(result.source).toBe("html");
  });

  it("ignores an extraneous Gmail signature image and styled name when plain text already looks like markdown", () => {
    // Real user report: pasting markdown from Gmail without first
    // removing the signature flips the heuristic back to the HTML
    // path because the signature contains an <img> and a bold/colored
    // name. The signature's visible text still matches plain text, so
    // when plain text already has multiple markdown markers (headings,
    // fences, lists, etc.) we trust it over Turndown's escape-everything
    // pass.
    const markdownBody = [
      "# Battery Alert for macOS",
      "",
      "## Setup",
      "",
      "1. Open **Automator**.",
      "2. Save it as `Battery Alert.app`.",
      "",
      "```applescript",
      "use scripting additions",
      "```",
      "",
      "- 20% — low",
      "- 10% — critical",
      "",
      "---",
    ].join("\n");

    const plainText = `${markdownBody}\n\nKjell Hedstrom`;

    const html = [
      ...markdownBody
        .split("\n")
        .map((line) =>
          line.length === 0 ? "<div><br></div>" : `<div>${line}</div>`,
        ),
      "<div><br></div>",
      '<div><img src="https://example.com/avatar.png" alt="" height="64" style="vertical-align:middle"><b style="color:#1a73e8">Kjell Hedstrom</b></div>',
    ].join("");

    const result = convertClipboardPasteToMarkdown({ html, plainText });

    expect(result.source).toBe("plainText");
    expect(result.markdown).toBe(plainText);
    expect(result.markdown).not.toMatch(/\\#/);
    expect(result.markdown).not.toMatch(/\\\*\\\*/);
  });

  it("keeps the html path for a real rich-text paste even when plain text has a single markdown-looking line", () => {
    // Defense-in-depth: a single markdown-looking line in plain text
    // is not enough to override real HTML formatting. The user pasted
    // genuine rich text from a web page; treat it as such.
    const html =
      "<h1>Real Heading</h1><p>Body text with <strong>bold</strong> and <a href=\"https://example.com\">a link</a>.</p>";
    const plainText = "Real Heading\nBody text with bold and a link.";

    const result = convertClipboardPasteToMarkdown({ html, plainText });

    expect(result.source).toBe("html");
    expect(result.markdown).toContain("# Real Heading");
    expect(result.markdown).toContain("**bold**");
    expect(result.markdown).toContain("[a link](https://example.com)");
  });

  it("treats span-wrapped plain markdown without formatting as a trivial wrapper", () => {
    // Some apps wrap each line in styled <span> elements that only
    // encode font-family or color (not bold/italic). These should not
    // count as meaningful formatting.
    const plainText = "# Heading\n\nSome **bold** text and `code`.";
    const html = plainText
      .split("\n")
      .map((line) =>
        line.length === 0
          ? "<div><br></div>"
          : `<div><span style="font-family: monospace; color: #333">${line}</span></div>`,
      )
      .join("");

    expect(
      convertClipboardPasteToMarkdown({ html, plainText }),
    ).toEqual({
      markdown: plainText,
      source: "plainText",
    });
  });
});

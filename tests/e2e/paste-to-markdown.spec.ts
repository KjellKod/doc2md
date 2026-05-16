import { expect, test, type Page } from "@playwright/test";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

async function pasteClipboardPayload(
  page: Page,
  payload: { html?: string; plainText?: string },
) {
  await page.getByLabel("Edit markdown").evaluate((node, value) => {
    const data = new DataTransfer();
    data.setData("text/html", value.html ?? "");
    data.setData("text/plain", value.plainText ?? "");

    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, payload);
}

async function pasteFromSystemClipboard(
  page: Page,
  payload: { html?: string; plainText: string },
) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(async (value) => {
    if (value.html) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([value.html], { type: "text/html" }),
          "text/plain": new Blob([value.plainText], { type: "text/plain" }),
        }),
      ]);
      return;
    }

    await navigator.clipboard.writeText(value.plainText);
  }, payload);

  await page.getByLabel("Edit markdown").focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
}

test("pasting Google Docs-style rich clipboard content inserts markdown", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");

  await pasteClipboardPayload(page, {
    html: [
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
    ].join(""),
    plainText:
      "Launch Plan\nBold priority and italic detail\nNormal item\nDone task\nOpen task",
  });

  await expect(editor).toHaveValue(
    [
      "# Launch Plan",
      "",
      "**Bold priority** and _italic detail_",
      "",
      "- Normal item",
      "- [x] Done task",
      "- [ ] Open task",
    ].join("\n"),
  );
});

test("pasting Google Docs checkbox image content inserts task list markdown", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");

  await pasteClipboardPayload(page, {
    html: [
      "<strong>",
      "<h1>Executive Summary Goals to Achieve in Q2</h1>",
      '<p><a href="mailto:art@example.com">Art Messal</a>:</p>',
      "<ul>",
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><span>100% completion of five must-do-epics 2026-Q2-100 labels</span></p></li>',
      '<li><img alt="unchecked" src="data:image/png;base64,abc"><p><a href="https://example.atlassian.net/browse/ONF-9505">ONF-9505</a><span> [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions</span></p></li>',
      '<li><img alt="checked" src="data:image/png;base64,abc"><a href="https://example.atlassian.net/browse/ONF-7952">ONF-7952</a><span> Q1-4c Whitelabel Client Portal</span></li>',
      "</ul>",
      "</strong>",
    ].join(""),
    plainText:
      "Executive Summary Goals to Achieve in Q2\nArt Messal:\n100% completion of five must-do-epics 2026-Q2-100 labels\nONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions\nONF-7952 Q1-4c Whitelabel Client Portal",
  });

  await expect(editor).toHaveValue(
    [
      "# Executive Summary Goals to Achieve in Q2",
      "",
      "[Art Messal](mailto:art@example.com):",
      "",
      "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
      "- [ ] [ONF-9505](https://example.atlassian.net/browse/ONF-9505) \\[EE\\] Refactor Task Endpoints to use Mongo Sessions and Transactions",
      "- [x] [ONF-7952](https://example.atlassian.net/browse/ONF-7952) Q1-4c Whitelabel Client Portal",
    ].join("\n"),
  );
});

test("pasting common LinkedIn unicode text inserts markdown markers", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");

  await pasteFromSystemClipboard(page, {
    plainText: "𝗕𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤",
  });

  await expect(editor).toHaveValue("**Bold** and *italic*");
});

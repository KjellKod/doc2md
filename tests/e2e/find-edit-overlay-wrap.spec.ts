// Regression pin for the edit-mode find overlay alignment bug.
//
// Symptom (user-reported on PR #123 review): on macOS with the
// "Always show scroll bars" Appearance setting, the find <mark> in the
// editor lights up a few lines above the actual matched word, and the
// offset compounds as the user scrolls through wrapped paragraphs.
//
// Root cause: the textarea has `overflow: auto`, so when content
// overflows AND classic scrollbars are enabled, the textarea reserves
// scrollbar width; the find overlay <pre> has `overflow: hidden` and
// reserves nothing. Their `clientWidth` then diverges, `pre-wrap`
// wraps each paragraph at a different column, and the overlay's
// <mark> ends up at a different content-y than the textarea's
// matched text.
//
// Fix: `scrollbar-gutter: stable` on both `.markdown-edit-area` and
// `.markdown-find-overlay`. This forces each to reserve scrollbar
// gutter regardless of the OS scrollbar mode (overlay vs classic) so
// their wrap widths are identical.
//
// This test cannot reproduce the wrap divergence in headless Chromium
// (Playwright always uses overlay scrollbars even when CSS targets
// the textarea's `::-webkit-scrollbar`). Instead it pins the CSS
// property on both elements — without it, the bug returns on every
// macOS user with classic scrollbars.

import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openEditor(page: Page) {
  await page.goto("./");
  const fcPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fc = await fcPromise;
  await fc.setFiles([
    {
      name: "wrap.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Doc\n\n" + "word ".repeat(2000)),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".markdown-edit-area")).toBeVisible();
  await expect(page.locator(".markdown-find-overlay")).toBeAttached();
}

test("editor textarea and find overlay both reserve a stable scrollbar gutter", async ({
  page,
}) => {
  await openEditor(page);

  const gutters = await page.evaluate(() => {
    const ta = document.querySelector(
      ".markdown-edit-area",
    ) as HTMLTextAreaElement;
    const ov = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLPreElement;
    return {
      taGutter: window.getComputedStyle(ta).scrollbarGutter,
      ovGutter: window.getComputedStyle(ov).scrollbarGutter,
    };
  });

  // Both must be `stable`. Without this, macOS users with classic
  // scrollbars see the find overlay <mark> drift above the matched
  // word in the textarea by N lines per wrapped paragraph.
  expect(gutters.taGutter).toBe("stable");
  expect(gutters.ovGutter).toBe("stable");
});

test("editor textarea and find overlay have identical clientWidth and scrollHeight", async ({
  page,
}) => {
  await openEditor(page);

  const widths = await page.evaluate(() => {
    const ta = document.querySelector(
      ".markdown-edit-area",
    ) as HTMLTextAreaElement;
    const ov = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLPreElement;
    return {
      taClientWidth: ta.clientWidth,
      ovClientWidth: ov.clientWidth,
      taScrollHeight: ta.scrollHeight,
      ovScrollHeight: ov.scrollHeight,
    };
  });

  // Identical inner widths → identical wrap layout. Without
  // `scrollbar-gutter: stable` on both, this can diverge under
  // classic-scrollbar OS settings and the find <mark> drifts.
  expect(widths.taClientWidth).toBe(widths.ovClientWidth);
  expect(widths.taScrollHeight).toBe(widths.ovScrollHeight);
});

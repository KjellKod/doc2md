// Regression test for the LinkedIn-mode find highlighting parity gap
// flagged on PR #123 (cubic-dev-ai inline comment at PreviewPanel.tsx:453).
//
// The old DOM-mutation path (`applyRenderedFindHighlight`) operated on
// `renderedViewRef.current`, which points at either `.markdown-surface`
// (Preview) or `.linkedin-surface` (LinkedIn). When that path was
// replaced by the `findHighlightRehype` plugin — which only runs through
// `react-markdown` — LinkedIn mode lost its active-match marker. This
// test asserts LinkedIn mode renders a <mark> for the active find match
// just like Preview mode does.
import { expect, test, type Page } from "@playwright/test";
import { openFindBar } from "./helpers/findBar";
import { Buffer } from "node:buffer";

// LinkedIn formatting converts **bold** / _italic_ into Unicode bold /
// italic codepoints, so a literal ASCII search inside emphasis ranges
// won't match. Keep the fixture plain so we can assert match counts
// deterministically.
const FIXTURE = [
  "# LinkedIn fixture",
  "",
  "Plain alpha here.",
  "",
  "Another alpha sentence in this paragraph.",
  "",
  "More alpha in this one.",
  "",
  "Closing alpha.",
].join("\n");

async function openInLinkedIn(page: Page) {
  await page.goto("./");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: "linkedin-find-fixture.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(FIXTURE),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
  await expect(page.locator(".linkedin-surface")).toBeVisible();
}

test("LinkedIn mode renders an active-match <mark> and advances on Next", async ({
  page,
}) => {
  await openInLinkedIn(page);

  await openFindBar(page);
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("alpha");
  // Match Case is on by default; lowercase "alpha" finds 4 plain
  // occurrences in the rendered LinkedIn text.
  await expect(page.locator(".find-replace-count")).toHaveText(/of 4/);

  // The LinkedIn surface should render the rehype-style highlight class —
  // injected declaratively here, not via DOM mutation.
  const highlight = page
    .locator(".linkedin-surface mark.markdown-rendered-find-highlight")
    .first();
  await expect(highlight).toBeAttached();
  await expect(highlight).toHaveText("alpha");

  // Advancing the match keeps exactly one active <mark> visible and the
  // surface text intact.
  const baselineText = await page
    .locator(".linkedin-surface")
    .evaluate((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());

  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/2 of 4/);
  await expect(
    page.locator(".linkedin-surface mark.markdown-rendered-find-highlight"),
  ).toHaveCount(1);
  const afterNextText = await page
    .locator(".linkedin-surface")
    .evaluate((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
  expect(afterNextText).toBe(baselineText);

  // Advance to the final match and ensure the same invariants hold.
  await page.getByRole("button", { name: "Next match" }).click();
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/4 of 4/);
  const afterFourthText = await page
    .locator(".linkedin-surface")
    .evaluate((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
  expect(afterFourthText).toBe(baselineText);
  await expect(
    page.locator(".linkedin-surface mark.markdown-rendered-find-highlight"),
  ).toHaveCount(1);
});

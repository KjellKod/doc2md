import { expect, test, type Page } from "@playwright/test";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

test("download availability is quiet and initiation feedback is truthful", async ({
  page,
}) => {
  await openScratchEditor(page);

  const editor = page.getByLabel("Edit markdown");
  const pill = page.locator(".save-state-pill");

  await editor.fill("# Hello");
  await expect(pill).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download Markdown" })).toBeEnabled();

  // The primary output action explicitly downloads a Markdown copy.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  // Browser feedback confirms initiation, not a verified disk write.
  await expect(pill).toHaveText(
    "Download started",
  );
  // Sighted mobile users also need the confirmation; a clipped live region
  // still passes text and ordinary visibility assertions.
  await expect(pill).toHaveCSS("clip-path", "none");
  const pillBox = await pill.boundingBox();
  expect(pillBox!.width).toBeGreaterThan(20);
  expect(pillBox!.height).toBeGreaterThan(16);
});

test("in-session edit survives opening and closing About", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("draft body");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "About doc2md", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "About doc2md" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-pressed", "true");

  await expect(editor).toHaveValue("draft body");
});

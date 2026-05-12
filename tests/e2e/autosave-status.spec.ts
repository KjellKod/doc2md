import { expect, test, type Page } from "@playwright/test";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

test("status pill flips to Unsaved on edit and to Saved with relative time on save", async ({
  page,
}) => {
  await openScratchEditor(page);

  const editor = page.getByLabel("Edit markdown");
  const pill = page.locator(".save-state-pill");

  await editor.fill("# Hello");
  await expect(pill).toHaveText("Unsaved");

  // Trigger Save via the visible Save button (downloads the file).
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save document" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  // After save, the pill renders "Saved · Ns ago".
  await expect(pill).toHaveText(/^Saved · \d+s ago$/);
});

test("in-session edit survives a tab switch within the same session", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("draft body");

  // Switch to Install & Use tab and back to Convert — content persists in
  // React state. (Explicitly: this test does NOT cover reload-survival,
  // which is deferred to doc2md-browser-crash-recovery.)
  await page.getByRole("tab", { name: "Install & Use" }).click();
  await page.getByRole("tab", { name: "Convert" }).click();

  await expect(editor).toHaveValue("draft body");
});

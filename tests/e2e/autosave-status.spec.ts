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
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Install & Use", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Install & Use" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download Markdown" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Rename document:/ })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "View mode" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Back to workspace", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-pressed", "true");

  await expect(editor).toHaveValue("draft body");
});

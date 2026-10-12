import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("region", { name: "Upload", exact: true })).toBeVisible();
}

async function uploadViaLandingBrowse(page: Page, name: string, body: string) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open files", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name, mimeType: "text/markdown", buffer: Buffer.from(body) },
  ]);
  await expect(
    page
      .getByLabel("Edit markdown")
      .or(page.getByRole("heading", { name: name.replace(/\.[^.]+$/, "") }))
      .or(page.getByRole("button", { name: `Open ${name}` })),
  ).toBeVisible();
}

test("opening a document keeps one combined toolbar and no introduction", async ({ page }) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");
  await expect(page.locator(".combined-toolbar")).toHaveCount(1);
  await expect(page.locator(".hero h1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rename document" })).toBeVisible();
});

test("workspace logo preserves documents after visiting Install & Use", async ({ page }) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Install & Use", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Install & Use" })).toBeVisible();
  await page.getByRole("button", { name: "doc2md workspace" }).click();
  await expect(page.getByRole("heading", { name: "Alpha", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show files" }).click();
  await expect(page.getByRole("button", { name: "Open alpha.md" })).toBeVisible();
});

test("workspace roundtrip preserves a manually expanded file list", async ({ page }) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");
  await page.getByRole("button", { name: "Show files" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Install & Use", exact: true }).click();
  await page.getByRole("button", { name: "doc2md workspace" }).click();
  await uploadViaLandingBrowse(page, "beta.md", "# Beta");
  await expect(page.getByRole("button", { name: "Hide files" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open beta.md" })).toBeVisible();
});

test("scratch creation enters the workspace with a focused editor", async ({ page }) => {
  await openHostedApp(page);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
  await expect(page.locator(".combined-toolbar")).toBeVisible();
  await expect(page.locator(".hero h1")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hide files" })).toBeVisible();
});

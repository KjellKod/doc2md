import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function uploadViaLandingBrowse(page: Page, name: string, body: string) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
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

test("working-mode bar replaces hero on non-scratch entry select", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");

  await expect(page.locator(".working-mode-bar")).toBeVisible();
  await expect(page.locator(".hero h1")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible();
});

test("logo returns to landing and entries persist", async ({ page }) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");

  await page.getByRole("button", { name: "Home" }).click();

  await expect(page.locator(".hero h1")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Convert", selected: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show upload panel" }).click();
  await expect(
    page.getByRole("button", { name: "Open alpha.md" }),
  ).toBeVisible();
});

test("home roundtrip does not re-fire first auto-collapse", async ({ page }) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");
  await expect(
    page.getByRole("button", { name: "Show upload panel" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Show upload panel" }).click();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();

  await uploadViaLandingBrowse(page, "beta.md", "# Beta");
  await page.getByRole("button", { name: "Open beta.md" }).click();

  await expect(page.locator(".working-mode-bar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();
});

test("scratch creation does not trigger working-mode chrome", async ({ page }) => {
  await openHostedApp(page);

  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();

  await expect(page.getByLabel("Edit markdown")).toBeFocused();
  await expect(page.locator(".hero h1")).toBeVisible();
  await expect(page.locator(".working-mode-bar")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();
});

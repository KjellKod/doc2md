import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("region", { name: "Upload", exact: true })).toBeVisible();
}

async function uploadOne(page: Page, name: string, body: string) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open files", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name, mimeType: "text/markdown", buffer: Buffer.from(body) },
  ]);
  await expect(page.getByLabel("Edit markdown").or(page.getByRole("heading", { name: name.replace(/\.[^.]+$/, "") }))).toBeVisible();
}

test("auto-collapses the upload panel on first file open", async ({ page }) => {
  await openHostedApp(page);
  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();

  await uploadOne(page, "alpha.md", "# Alpha");

  // Sidebar collapses to the rail; the "Show files" button is the rail.
  await expect(
    page.getByRole("button", { name: "Show files" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toHaveCount(0);
});

test("collapsed files toggle has a focus tooltip inside the viewport", async ({ page }) => {
  await openHostedApp(page);
  await uploadOne(page, "alpha.md", "# Alpha");
  const showFiles = page.getByRole("button", { name: "Show files" });
  await showFiles.focus();
  const tooltip = showFiles.getByRole("tooltip");
  await expect(tooltip).toHaveText("Show files");
  await expect(tooltip).toHaveCSS("opacity", "1");
  const box = await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("does not auto-collapse when the user has already adjusted the sidebar", async ({
  page,
}) => {
  await openHostedApp(page);

  // Manually collapse first.
  await page
    .getByRole("button", { name: "Hide files" })
    .click();
  await expect(
    page.getByRole("button", { name: "Show files" }),
  ).toBeVisible();

  // Re-expand.
  await page
    .getByRole("button", { name: "Show files" })
    .click();
  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();

  // Now upload a file; auto-collapse should be inhibited.
  await uploadOne(page, "beta.md", "# Beta");

  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();
});

test("scratch draft creation does not trigger auto-collapse", async ({ page }) => {
  await openHostedApp(page);
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
  // Sidebar stays visible — "Start writing" should not slam the upload chrome away.
  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();
});

test("auto-collapse is one-shot — manual expand survives a second file open", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadOne(page, "alpha.md", "# Alpha");
  // First open collapsed the sidebar (one-shot has fired); user re-expands.
  await page.getByRole("button", { name: "Show files" }).click();
  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();

  // Open a second file via the file chooser. The one-shot guard prevents
  // another auto-collapse, so the sidebar stays expanded.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open files", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name: "beta.md", mimeType: "text/markdown", buffer: Buffer.from("# Beta") },
  ]);
  await expect(
    page.getByRole("button", { name: "Open beta.md" }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Hide files" }),
  ).toBeVisible();
});

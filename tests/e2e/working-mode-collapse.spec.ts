import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function uploadOne(page: Page, name: string, body: string) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
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
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();

  await uploadOne(page, "alpha.md", "# Alpha");

  // Sidebar collapses to the rail; the "Show upload panel" button is the rail.
  await expect(
    page.getByRole("button", { name: "Show upload panel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toHaveCount(0);
});

test("shows the upload rail tooltip while collapsed", async ({ page }) => {
  await openHostedApp(page);
  await uploadOne(page, "alpha.md", "# Alpha");

  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  await showUpload.focus();

  const tooltipId = await showUpload.getAttribute("aria-describedby");
  expect(tooltipId).toBeTruthy();

  const tooltip = page.locator(`#${tooltipId}`);
  await expect(tooltip).toHaveAttribute("role", "tooltip");
  await expect(tooltip).toHaveText("Show upload panel");
  await expect(tooltip).toHaveCSS("opacity", "1");

  const railOverflow = await showUpload
    .locator("xpath=..")
    .evaluate((element) => getComputedStyle(element).overflow);
  expect(railOverflow).toBe("visible");

  const tooltipBox = await tooltip.boundingBox();
  const showUploadBox = await showUpload.boundingBox();
  const viewport = page.viewportSize();
  expect(tooltipBox).not.toBeNull();
  expect(showUploadBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  expect(tooltipBox!.x).toBeGreaterThanOrEqual(
    showUploadBox!.x + showUploadBox!.width,
  );
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(0);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(
    Math.abs(
      tooltipBox!.y +
        tooltipBox!.height / 2 -
        (showUploadBox!.y + showUploadBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(8);
});

test("does not auto-collapse when the user has already adjusted the sidebar", async ({
  page,
}) => {
  await openHostedApp(page);

  // Manually collapse first.
  await page
    .getByRole("button", { name: "Hide upload panel" })
    .click();
  await expect(
    page.getByRole("button", { name: "Show upload panel" }),
  ).toBeVisible();

  // Re-expand.
  await page
    .getByRole("button", { name: "Show upload panel" })
    .click();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();

  // Now upload a file; auto-collapse should be inhibited.
  await uploadOne(page, "beta.md", "# Beta");

  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
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
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();
});

test("auto-collapse is one-shot — manual expand survives a second file open", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadOne(page, "alpha.md", "# Alpha");
  // First open collapsed the sidebar (one-shot has fired); user re-expands.
  await page.getByRole("button", { name: "Show upload panel" }).click();
  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();

  // Open a second file via the file chooser. The one-shot guard prevents
  // another auto-collapse, so the sidebar stays expanded.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name: "beta.md", mimeType: "text/markdown", buffer: Buffer.from("# Beta") },
  ]);
  await expect(
    page.getByRole("button", { name: "Open beta.md" }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Hide upload panel" }),
  ).toBeVisible();
});

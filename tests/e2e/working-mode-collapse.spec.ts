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

  const rail = showUpload.locator("xpath=..");
  const railOverflow = await rail.evaluate(
    (element) => getComputedStyle(element).overflow,
  );
  expect(railOverflow).toBe("visible");

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  // De-flake: the tooltip is centered on the rail via `top: 50%` +
  // `translateY(-50%)`, so its center equals the rail center by construction.
  // The previous check read tooltipBox and railBox in separate boundingBox()
  // calls, so a layout shift between them (a late web-font swap changing the
  // rail height) compared two different layout states and intermittently
  // reported a ~11px offset in CI. Wait for fonts to settle, then read every
  // rect in ONE synchronous frame and retry until stable, so tooltip and rail
  // are always measured in the same layout state.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  await expect(async () => {
    const geom = await tooltip.evaluate((tip) => {
      const button = document.querySelector(
        'button[aria-label="Show upload panel"]',
      ) as HTMLElement;
      const rail = button.parentElement as HTMLElement;
      const t = tip.getBoundingClientRect();
      const r = rail.getBoundingClientRect();
      const b = button.getBoundingClientRect();
      return {
        tooltipLeft: t.x,
        tooltipRight: t.x + t.width,
        tooltipTop: t.y,
        tooltipBottom: t.y + t.height,
        tooltipCenterY: t.y + t.height / 2,
        railCenterY: r.y + r.height / 2,
        buttonRight: b.x + b.width,
      };
    });

    // Tooltip sits to the right of the button, fully within the viewport.
    expect(geom.tooltipLeft).toBeGreaterThanOrEqual(geom.buttonRight);
    expect(geom.tooltipLeft).toBeGreaterThanOrEqual(0);
    expect(geom.tooltipRight).toBeLessThanOrEqual(viewport!.width);
    expect(geom.tooltipTop).toBeGreaterThanOrEqual(0);
    expect(geom.tooltipBottom).toBeLessThanOrEqual(viewport!.height);

    // Tooltip is vertically centered on the rail (measured in one frame).
    expect(
      Math.abs(geom.tooltipCenterY - geom.railCenterY),
    ).toBeLessThanOrEqual(8);
  }).toPass({ timeout: 5000 });
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

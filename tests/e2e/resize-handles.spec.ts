import { expect, test, type Locator, type Page } from "@playwright/test";

const EPSILON_PX = 6;

async function openHostedApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("renders split-pane resize handles with separator roles", async ({
  page,
}) => {
  await openHostedApp(page);

  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });

  await expect(splitBar).toBeVisible();
  await expect(splitBar).toHaveAttribute("aria-orientation", "vertical");
  await expect(heightHandle).toBeVisible();
  await expect(heightHandle).toHaveAttribute("aria-orientation", "horizontal");
});

test("narrows and snap-collapses the upload panel from the split bar", async ({
  page,
}) => {
  await openHostedApp(page);

  const sidebar = page.locator(".sidebar-panel");
  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  const initialSidebarBox = await boundingBox(sidebar);
  const splitBarBox = await boundingBox(splitBar);

  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForFunction(() =>
    document.body.classList.contains("is-sidebar-resizing"),
  );
  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2 + 120,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.mouse.up();

  const narrowedSidebarBox = await boundingBox(sidebar);
  expect(narrowedSidebarBox.width).toBeLessThan(initialSidebarBox.width);
  expect(narrowedSidebarBox.width).toBeGreaterThan(200);

  const narrowedSplitBarBox = await boundingBox(splitBar);
  await page.mouse.dblclick(
    narrowedSplitBarBox.x + narrowedSplitBarBox.width / 2,
    narrowedSplitBarBox.y + narrowedSplitBarBox.height / 2,
  );
  await expect
    .poll(async () => (await boundingBox(sidebar)).width)
    .toBeGreaterThanOrEqual(initialSidebarBox.width - EPSILON_PX);

  const resetSplitBarBox = await boundingBox(splitBar);
  await page.mouse.move(
    resetSplitBarBox.x + resetSplitBarBox.width / 2,
    resetSplitBarBox.y + resetSplitBarBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForFunction(() =>
    document.body.classList.contains("is-sidebar-resizing"),
  );
  await page.mouse.move(
    resetSplitBarBox.x + resetSplitBarBox.width / 2 + 260,
    resetSplitBarBox.y + resetSplitBarBox.height / 2,
  );
  await page.mouse.up();

  await expect(page.getByRole("button", { name: "Show upload panel" })).toBeVisible();
  await expect(splitBar).toHaveCount(0);
});

test("grows and resets the editor height from the bottom handle", async ({
  page,
}) => {
  await openHostedApp(page);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

  const previewPanel = page.locator(".preview-panel");
  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await heightHandle.scrollIntoViewIfNeeded();
  const initialPreviewBox = await boundingBox(previewPanel);
  const heightHandleBox = await boundingBox(heightHandle);

  await page.mouse.move(
    heightHandleBox.x + heightHandleBox.width / 2,
    heightHandleBox.y + heightHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForFunction(() =>
    document.body.classList.contains("is-height-resizing"),
  );
  await page.mouse.move(
    heightHandleBox.x + heightHandleBox.width / 2,
    heightHandleBox.y + heightHandleBox.height / 2 + 140,
  );
  await page.mouse.up();

  const grownPreviewBox = await boundingBox(previewPanel);
  expect(grownPreviewBox.height).toBeGreaterThan(
    initialPreviewBox.height + 80,
  );

  await heightHandle.dblclick();
  const resetPreviewBox = await boundingBox(previewPanel);
  expect(resetPreviewBox.height).toBeLessThanOrEqual(
    initialPreviewBox.height + EPSILON_PX,
  );
});

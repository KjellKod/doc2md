import { expect, test, type Locator, type Page } from "@playwright/test";

const EPSILON_PX = 6;

async function openHostedApp(page: Page, height = 1200) {
  await page.setViewportSize({ width: 1440, height });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function dragFromCenter(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY: number,
) {
  const box = await boundingBox(locator);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + deltaX,
    box.y + box.height / 2 + deltaY,
  );
  await page.mouse.up();
}

test("renders split-pane resize handles with separator roles", async ({
  page,
}) => {
  await openHostedApp(page);

  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  await expect(splitBar).toBeVisible();
  await expect(splitBar).toHaveAttribute("aria-orientation", "vertical");

  await expect(
    page.getByRole("separator", { name: "Resize editor height" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();

  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await expect(heightHandle).toBeVisible();
  await expect(heightHandle).toHaveAttribute("aria-orientation", "horizontal");
});

test("vertical drag direction matches the cursor", async ({
  page,
}) => {
  await openHostedApp(page, 1600);

  const sidebar = page.locator(".sidebar-panel");
  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  const initialSidebarBox = await boundingBox(sidebar);

  await dragFromCenter(page, splitBar, -120, 0);

  const narrowedSidebarBox = await boundingBox(sidebar);
  expect(narrowedSidebarBox.width).toBeLessThan(initialSidebarBox.width);
  expect(narrowedSidebarBox.width).toBeGreaterThan(200);

  await dragFromCenter(page, splitBar, 60, 0);
  const grownSidebarBox = await boundingBox(sidebar);
  expect(grownSidebarBox.width).toBeGreaterThan(narrowedSidebarBox.width);
  expect(grownSidebarBox.width).toBeLessThanOrEqual(
    initialSidebarBox.width + EPSILON_PX,
  );
});

test("resets and snap-collapses the upload panel from the split bar", async ({
  page,
}) => {
  await openHostedApp(page);

  const sidebar = page.locator(".sidebar-panel");
  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  const initialSidebarBox = await boundingBox(sidebar);

  await dragFromCenter(page, splitBar, -120, 0);

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
    resetSplitBarBox.x + resetSplitBarBox.width / 2 - 260,
    resetSplitBarBox.y + resetSplitBarBox.height / 2,
  );
  await page.mouse.up();

  await expect(page.getByRole("button", { name: "Show upload panel" })).toBeVisible();
  await expect(splitBar).toHaveCount(0);
});

test("shrinks and resets the editor height from the bottom handle", async ({
  page,
}) => {
  await openHostedApp(page, 1600);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

  const previewPanel = page.locator(".preview-panel");
  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await heightHandle.scrollIntoViewIfNeeded();
  const initialPreviewBox = await boundingBox(previewPanel);

  await dragFromCenter(page, heightHandle, 0, -120);

  const shrunkPreviewBox = await boundingBox(previewPanel);
  expect(shrunkPreviewBox.height).toBeLessThan(initialPreviewBox.height - 60);

  await heightHandle.dblclick();
  const resetPreviewBox = await boundingBox(previewPanel);
  expect(resetPreviewBox.height).toBeGreaterThanOrEqual(
    initialPreviewBox.height - EPSILON_PX,
  );
});

test("split bar bottom tracks preview bottom after horizontal drag", async ({
  page,
}) => {
  await openHostedApp(page);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

  const previewPanel = page.locator(".preview-panel");
  const splitBar = page.getByRole("separator", {
    name: "Resize upload panel",
  });
  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });

  await dragFromCenter(page, heightHandle, 0, -220);

  const splitBarBox = await boundingBox(splitBar);
  const previewBox = await boundingBox(previewPanel);
  expect(Math.abs(splitBarBox.y + splitBarBox.height - (previewBox.y + previewBox.height))).toBeLessThanOrEqual(EPSILON_PX);
});

test("horizontal mousedown has no visible jump for tall documents", async ({
  page,
}) => {
  await openHostedApp(page);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit markdown" });
  await expect(editor).toBeVisible();
  await editor.fill(
    Array.from({ length: 500 }, (_, index) => `# Section ${index + 1}\n\nBody`).join(
      "\n\n",
    ),
  );

  const previewPanel = page.locator(".preview-panel");
  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await heightHandle.scrollIntoViewIfNeeded();
  const beforeBox = await boundingBox(previewPanel);
  const handleBox = await boundingBox(heightHandle);

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 3);
  await page.mouse.down();
  const afterMouseDownBox = await boundingBox(previewPanel);
  await page.mouse.up();

  expect(Math.abs(afterMouseDownBox.height - beforeBox.height)).toBeLessThanOrEqual(
    EPSILON_PX,
  );
});

test("focus rings use the same outline treatment", async ({ page }) => {
  await openHostedApp(page);
  await page.getByRole("button", { name: "Start writing", exact: true }).click();

  const surfaces = [
    page.getByRole("textbox", { name: "Edit markdown" }),
    page.getByRole("separator", { name: "Resize upload panel" }),
    page.getByRole("separator", { name: "Resize editor height" }),
    page.getByRole("button", { name: "Hide upload panel" }),
    page.getByRole("tab", { name: "Convert" }),
  ];

  const outlines: Array<{ color: string; width: string }> = [];
  for (const surface of surfaces) {
    await surface.focus();
    outlines.push(
      await surface.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          color: style.outlineColor,
          width: style.outlineWidth,
        };
      }),
    );
  }

  const [{ color }] = outlines;
  for (const outline of outlines) {
    expect(outline.color).toBe(color);
    expect(outline.width).toBe("2px");
  }
});

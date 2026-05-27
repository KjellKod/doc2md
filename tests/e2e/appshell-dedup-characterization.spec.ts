// AppShell dedup Phase 2 — hosted web characterization spec.
//
// Locks the byte-identical geometry baseline before the AppShell extraction.
// Tests assert string equality on specific CSS variable values, inline
// style.width / style.height strings on the workspace and edit-shell, and
// the body resize class attribute at deterministic breakpoints. Commit
// baseline snapshot constants live inline below.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

// Baseline snapshot constants. Asserted byte-identical across pre- and
// post-refactor `main`. Values picked at deterministic resize breakpoints
// from the resize helpers in src/App.tsx (DEFAULT_SIDEBAR_WIDTH=380,
// BASE_PAGE_MAX_WIDTH=1680, SIDEBAR_COLLAPSE_WIDTH=56,
// MIN_EDIT_SHELL_HEIGHT=240).
const BASELINE_PAGE_MAX_WIDTH_PX = "1680px";
const BASELINE_DEFAULT_SIDEBAR_WIDTH_PX = "380px";
const BASELINE_MIN_EDIT_SHELL_HEIGHT = 240;
const BASELINE_BODY_IDLE_CLASS_INCLUDES_RESIZING = false;

async function openHostedApp(page: Page, height = 1200) {
  await page.setViewportSize({ width: 1440, height });
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
}

async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("page-frame --page-max-width baseline is byte-identical", async ({
  page,
}) => {
  await openHostedApp(page);

  const pageFrame = page.locator(".page-frame");
  await expect(pageFrame).toHaveAttribute(
    "style",
    `--page-max-width: ${BASELINE_PAGE_MAX_WIDTH_PX};`,
  );
});

test("workspace --sidebar-width default baseline is byte-identical", async ({
  page,
}) => {
  await openHostedApp(page);

  const workspace = page.locator(".workspace");
  await expect(workspace).toHaveAttribute(
    "style",
    `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
  );
});

test("body resize class is absent when idle and present during drag", async ({
  page,
}) => {
  await openHostedApp(page);

  const splitBar = page.getByRole("separator", { name: "Resize upload panel" });
  const splitBarBox = await boundingBox(splitBar);

  // Idle baseline: neither class present.
  const idleClass = await page.evaluate(() => document.body.className);
  expect(idleClass.includes("is-sidebar-resizing")).toBe(
    BASELINE_BODY_IDLE_CLASS_INCLUDES_RESIZING,
  );
  expect(idleClass.includes("is-height-resizing")).toBe(
    BASELINE_BODY_IDLE_CLASS_INCLUDES_RESIZING,
  );

  // Mid-drag: is-sidebar-resizing must be present.
  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2 - 40,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.waitForFunction(() =>
    document.body.classList.contains("is-sidebar-resizing"),
  );
  const midDragClass = await page.evaluate(() => document.body.className);
  expect(midDragClass.includes("is-sidebar-resizing")).toBe(true);
  await page.mouse.up();

  // Post-drag: class removed.
  await page.waitForFunction(
    () => !document.body.classList.contains("is-sidebar-resizing"),
  );
});

test("sidebar drag updates --sidebar-width inline string and round-trips on reset", async ({
  page,
}) => {
  await openHostedApp(page);

  const workspace = page.locator(".workspace");
  const splitBar = page.getByRole("separator", { name: "Resize upload panel" });

  await expect(workspace).toHaveAttribute(
    "style",
    `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
  );

  const splitBarBox = await boundingBox(splitBar);
  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    splitBarBox.x + splitBarBox.width / 2 - 80,
    splitBarBox.y + splitBarBox.height / 2,
  );
  await page.mouse.up();

  // Inline style must contain the --sidebar-width CSS variable with px units.
  const draggedStyle = await workspace.getAttribute("style");
  expect(draggedStyle).toMatch(/^--sidebar-width: \d+px;$/);
  expect(draggedStyle).not.toBe(
    `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
  );

  // Reset (Home key on the split bar) returns to byte-identical baseline.
  await splitBar.focus();
  await page.keyboard.press("Home");
  await expect(workspace).toHaveAttribute(
    "style",
    `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
  );
});

test("preview panel --preview-panel-ceiling baseline is well-formed and editor height drag updates inline height string", async ({
  page,
}) => {
  await openHostedApp(page, 1600);
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

  const previewPanel = page.locator(".preview-panel");

  // Idle: only ceiling variable, no inline height/minHeight yet.
  const idleStyle = await previewPanel.getAttribute("style");
  expect(idleStyle).toMatch(/^--preview-panel-ceiling: \d+px;$/);

  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await heightHandle.scrollIntoViewIfNeeded();
  const handleBox = await boundingBox(heightHandle);
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 3);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 120);
  await page.mouse.up();

  // Post-drag: style must include ceiling, height, and minHeight as
  // px-quantized integers, in that order, matching the previewPanelStyle
  // object shape from src/App.tsx:817-823.
  const postDragStyle = await previewPanel.getAttribute("style");
  expect(postDragStyle).toMatch(
    /^--preview-panel-ceiling: \d+px; height: \d+px; min-height: \d+px;$/,
  );

  // Reset returns to idle string (no height/minHeight).
  await heightHandle.dblclick();
  const resetStyle = await previewPanel.getAttribute("style");
  expect(resetStyle).toMatch(/^--preview-panel-ceiling: \d+px;$/);
});

test("MIN_EDIT_SHELL_HEIGHT lower-bound clamp is enforced", async ({
  page,
}) => {
  await openHostedApp(page, 1600);
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

  const heightHandle = page.getByRole("separator", {
    name: "Resize editor height",
  });
  await heightHandle.scrollIntoViewIfNeeded();
  const handleBox = await boundingBox(heightHandle);

  // Drag far upward to try to push below clamp.
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 3);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 5000);
  await page.mouse.up();

  const clampedStyle = await page
    .locator(".preview-panel")
    .getAttribute("style");
  // The post-drag inline style format is asserted above. Here we extract
  // the height integer and assert the MIN_EDIT_SHELL_HEIGHT clamp.
  const heightMatch = clampedStyle?.match(/ height: (\d+)px;/);
  expect(heightMatch).not.toBeNull();
  const clampedHeightPx = Number(heightMatch![1]);
  expect(clampedHeightPx).toBeGreaterThanOrEqual(BASELINE_MIN_EDIT_SHELL_HEIGHT);
});

test("view switcher tabs reflect aria-selected and view-switcher-meta text matches landing summary", async ({
  page,
}) => {
  await openHostedApp(page);

  const convertTab = page.getByRole("tab", { name: "Convert" });
  const installTab = page.getByRole("tab", { name: "Install & Use" });

  await expect(convertTab).toHaveAttribute("aria-selected", "true");
  await expect(installTab).toHaveAttribute("aria-selected", "false");

  // Landing meta string is the empty-state buildSummary text. Asserted
  // byte-identical here, matching the buildSummary call at App.tsx:270.
  await expect(page.locator(".view-switcher-meta")).toHaveText(
    "Start writing or open files from your device",
  );

  await installTab.click();
  await expect(installTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".view-switcher-meta")).toHaveText(
    "CLI, Node, and portable skill setup from one place",
  );
});

test("working-mode chrome auto-collapses upload sidebar on first non-scratch open and stays manual after re-expand", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "alpha.md", "# Alpha");

  // First open should auto-collapse the sidebar into the rail.
  await expect(
    page.getByRole("button", { name: "Show upload panel" }),
  ).toBeVisible();

  // Manually expand it.
  await page.getByRole("button", { name: "Show upload panel" }).click();
  await expect(page.locator(".sidebar-panel")).toBeVisible();

  // Open a second file: it must NOT auto-collapse again because the user
  // already expressed a sidebar preference (the one-shot guard at
  // firstAutoCollapseFiredRef in src/App.tsx).
  await uploadViaLandingBrowse(page, "beta.md", "# Beta");
  await expect(page.locator(".sidebar-panel")).toBeVisible();
});

test("drop-zone browse button triggers hosted file chooser and adds the file", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadViaLandingBrowse(page, "gamma.md", "# Gamma");
  // Auto-collapse fires on first non-scratch open; expand again so the
  // file list is visible for the assertion below.
  await page.getByRole("button", { name: "Show upload panel" }).click();
  await expect(
    page.getByRole("button", { name: "Open gamma.md" }),
  ).toBeVisible();
});

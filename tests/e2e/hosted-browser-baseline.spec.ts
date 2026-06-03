import {
  expect,
  test,
  type Download,
  type Locator,
  type Page,
} from "@playwright/test";
import { Buffer } from "node:buffer";

type MarkdownFixture = {
  name: string;
  body: string;
};

const files: MarkdownFixture[] = [
  {
    name: "alpha.md",
    body: "# Alpha\n\nAlpha converted content.",
  },
  {
    name: "beta.md",
    body: "# Beta\n\nBeta converted content.",
  },
  {
    name: "gamma.md",
    body: "# Gamma\n\nGamma converted content.",
  },
];

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function uploadMarkdownFiles(page: Page, fixtures: MarkdownFixture[]) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles(
    fixtures.map(({ name, body }) => ({
      name,
      mimeType: "text/markdown",
      buffer: Buffer.from(body),
    })),
  );

  // First file open triggers working-mode auto-collapse; re-expand so the
  // file-list buttons remain locatable for tests that interact with them.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (
    await showUpload
      .waitFor({ state: "visible", timeout: 1500 })
      .then(() => true)
      .catch(() => false)
  ) {
    await showUpload.click();
  }

  for (const { name } of fixtures) {
    await expect(page.getByRole("button", { name: `Open ${name}` })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `Select ${name}` })).toBeVisible();
  }
}

async function expectPreviewHeading(page: Page, name: string) {
  await expect(
    page
      .getByRole("region", { name: "View" })
      .getByRole("heading", { name }),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));

  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.document).toBeLessThanOrEqual(1);
}

async function expectNoOverlap(first: Locator, second: Locator) {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ]);

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  const a = firstBox!;
  const b = secondBox!;
  const overlaps =
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  expect(overlaps).toBe(false);
}

function expectWithinTolerance(actual: number, expected: number, tolerancePx = 2) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerancePx);
}

test("loads hosted app regions and empty states", async ({ page }) => {
  await openHostedApp(page);

  await expect(
    page.getByRole("heading", { name: "Files", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "View" })).toBeVisible();
  await expect(
    page.getByText("No files or drafts yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nothing to preview yet.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start writing", exact: true })).toBeVisible();
});

test("creates and edits a scratch draft", async ({ page }) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  const editor = page.getByLabel("Edit markdown");
  await expect(editor).toBeFocused();
  await editor.fill("# Browser baseline draft\n\nPlaywright edits real focus.");

  await expect(
    page.getByRole("button", { name: "Open Browser baseline draft" }),
  ).toBeVisible();
  await expect(editor).toHaveValue(
    "# Browser baseline draft\n\nPlaywright edits real focus.",
  );
  await expect(page.getByRole("button", { name: "Save document" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Download active file" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "View" }).click();
  await expectPreviewHeading(page, "Browser baseline draft");
});

test("renders GFM task lists as checkboxes without bullet markers", async ({
  page,
}) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("- [x] Ship fix\n- [ ] Write docs");

  await page.getByRole("button", { name: "View" }).click();

  const taskItems = page.locator(".markdown-surface li.task-list-item");
  await expect(taskItems).toHaveCount(2);
  await expect(page.locator(".markdown-surface")).not.toContainText("[x]");
  await expect(page.locator(".markdown-surface")).not.toContainText("[ ]");
  await expect(taskItems.first()).toHaveCSS("list-style-type", "none");
  await expect(taskItems.nth(1)).toHaveCSS("list-style-type", "none");
  await expect(taskItems.first()).toContainText("Ship fix");
  await expect(taskItems.nth(1)).toContainText("Write docs");
  await expect(taskItems.first().locator('input[type="checkbox"]')).toBeChecked();
  await expect(taskItems.nth(1).locator('input[type="checkbox"]')).not.toBeChecked();
});

test("toggles a task checkbox in View and shows the changed marker in Edit", async ({
  page,
}) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await page
    .getByLabel("Edit markdown")
    .fill("- [ ] Ship fix\n- [x] Keep checked");

  await page.getByRole("button", { name: "View" }).click();
  await page
    .getByRole("checkbox", { name: "Toggle task: Ship fix" })
    .check();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Edit markdown")).toHaveValue(
    "- [x] Ship fix\n- [x] Keep checked",
  );
});

test("checks and unchecks a task checkbox directly in View", async ({ page }) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  await page
    .getByLabel("Edit markdown")
    .fill("- [ ] Ship fix\n- [x] Keep checked");

  await page.getByRole("button", { name: "View" }).click();

  const shipFix = page.getByRole("checkbox", { name: "Toggle task: Ship fix" });
  await expect(shipFix).not.toBeChecked();

  await shipFix.click();
  await expect(shipFix).toBeChecked();

  await shipFix.click();
  await expect(shipFix).not.toBeChecked();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Edit markdown")).toHaveValue(
    "- [ ] Ship fix\n- [x] Keep checked",
  );
});

test("checks and unchecks task checkboxes for an opened markdown file in View", async ({
  page,
}) => {
  await openHostedApp(page);

  await uploadMarkdownFiles(page, [
    {
      name: "tasks.md",
      body: "- [ ] Ship fix\n- [x] Keep checked",
    },
  ]);

  await page.getByRole("button", { name: "View" }).click();

  const shipFix = page.getByRole("checkbox", { name: "Toggle task: Ship fix" });
  await expect(shipFix).not.toBeChecked();

  await shipFix.click();
  await expect(shipFix).toBeChecked();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Edit markdown")).toHaveValue(
    "- [x] Ship fix\n- [x] Keep checked",
  );

  await page.getByRole("button", { name: "View" }).click();
  const checkedShipFix = page.getByRole("checkbox", {
    name: "Toggle task: Ship fix",
  });
  await expect(checkedShipFix).toBeChecked();

  await checkedShipFix.click();
  await expect(checkedShipFix).not.toBeChecked();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Edit markdown")).toHaveValue(
    "- [ ] Ship fix\n- [x] Keep checked",
  );
});

test("renders nested GFM task list checkboxes indented at matching size", async ({
  page,
}) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing", exact: true }).click();
  const editor = page.getByLabel("Edit markdown");
  await editor.fill(
    [
      "- [ ] 100% completion of five must-do-epics 2026-Q2-100 labels",
      "",
      "  - [ ] ONF-9505 [EE] Refactor Task Endpoints to use Mongo Sessions and Transactions",
      "- [ ] ONF-7952 Q1-4c Whitelabel Client Portal",
    ].join("\n"),
  );

  await page.getByRole("button", { name: "View" }).click();

  const taskItems = page.locator(".markdown-surface li.task-list-item");
  await expect(taskItems).toHaveCount(3);

  const renderedCheckboxes = page.locator(
    ".markdown-surface input[type='checkbox']",
  );
  await expect(renderedCheckboxes).toHaveCount(3);
  const parentCheckbox = renderedCheckboxes.nth(0);
  const nestedCheckbox = renderedCheckboxes.nth(1);
  const thirdCheckbox = renderedCheckboxes.nth(2);

  const parentBox = await parentCheckbox.boundingBox();
  const nestedBox = await nestedCheckbox.boundingBox();
  const thirdBox = await thirdCheckbox.boundingBox();

  expect(parentBox).not.toBeNull();
  expect(nestedBox).not.toBeNull();
  expect(thirdBox).not.toBeNull();
  expect(nestedBox!.x).toBeGreaterThan(parentBox!.x + 12);
  expect(thirdBox!.x).toBeCloseTo(parentBox!.x, 1);
  expect(nestedBox!.width).toBeCloseTo(parentBox!.width, 1);
  expect(nestedBox!.height).toBeCloseTo(parentBox!.height, 1);
});

test("keeps checkbox selection separate from active row selection", async ({
  page,
}) => {
  await openHostedApp(page);
  await uploadMarkdownFiles(page, files);
  await expectPreviewHeading(page, "Alpha");

  await page.getByRole("checkbox", { name: "Select beta.md" }).check();
  await expect(page.getByRole("checkbox", { name: "Select beta.md" })).toBeChecked();
  await expectPreviewHeading(page, "Alpha");

  await page.getByRole("button", { name: "Open gamma.md" }).click();
  await expectPreviewHeading(page, "Gamma");
});

test("applies bulk clear and download toolbar behavior", async ({ page }) => {
  await openHostedApp(page);
  await uploadMarkdownFiles(page, files);

  await page.getByRole("checkbox", { name: "Select beta.md" }).check();
  await page.getByRole("checkbox", { name: "Select gamma.md" }).check();

  const downloads: Download[] = [];
  const collectDownload = (download: Download) => {
    downloads.push(download);
  };
  page.on("download", collectDownload);
  await page.getByRole("button", { name: "Download selected files" }).click();
  await expect(page.getByRole("checkbox", { name: "Select beta.md" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Select gamma.md" })).not.toBeChecked();
  page.off("download", collectDownload);

  expect(downloads).toHaveLength(2);
  expect(downloads.map((download) => download.suggestedFilename()).sort()).toEqual([
    "beta.md",
    "gamma.md",
  ]);

  await page.getByRole("button", { name: "Clear active file" }).click();
  await expect(page.getByRole("button", { name: "Open alpha.md" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open beta.md" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open gamma.md" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Select beta.md" }).check();
  await page.getByRole("button", { name: "Clear selected files" }).click();
  await expect(page.getByRole("button", { name: "Open beta.md" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open gamma.md" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select gamma.md" })).not.toBeChecked();
});

test("keeps the file sidebar usable at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 900 });
  await openHostedApp(page);
  await uploadMarkdownFiles(page, [
    {
      name: "very-long-document-name-for-responsive-sidebar-overflow-check.md",
      body: "# Long responsive title\n\nLong names should stay contained.",
    },
    {
      name: "short.md",
      body: "# Short\n\nSecond row for responsive checks.",
    },
  ]);

  await expectNoHorizontalOverflow(page);

  const selectAll = page.getByRole("checkbox", {
    name: "Select all opened files",
  });
  const download = page.getByRole("button", { name: "Download active file" });
  const clear = page.getByRole("button", { name: "Clear active file" });
  await expectNoOverlap(selectAll, download);
  await expectNoOverlap(selectAll, clear);
  await expectNoOverlap(download, clear);

  const longCheckbox = page.getByRole("checkbox", {
    name: "Select very-long-document-name-for-responsive-sidebar-overflow-check.md",
  });
  const longRow = page.getByRole("button", {
    name: "Open very-long-document-name-for-responsive-sidebar-overflow-check.md",
  });
  await expectNoOverlap(longCheckbox, longRow);
  await expectNoHorizontalOverflow(page);
});

test("keeps desktop working-mode layout characterized at 1280 and 1440", async ({
  page,
}) => {
  // AC5 regression shield: step-1 desktop geometry characterization.
  // The hosted shell keeps 20px page padding on each side, sidebar width
  // 380px, and an 8px split gutter at these widths.
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await openHostedApp(page);
    await uploadMarkdownFiles(page, [
      {
        name: "desktop-characterization.md",
        body: "# Desktop characterization\n\nWidth regression anchor.",
      },
    ]);

    const sidebar = page.locator(".sidebar-panel");
    const preview = page.locator(".preview-panel");
    const [sidebarBox, previewBox] = await Promise.all([
      sidebar.boundingBox(),
      preview.boundingBox(),
    ]);

    expect(sidebarBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    const expectedWorkspaceWidth = viewport.width - 40;
    const expectedSidebarWidth = 380;
    const expectedGutterWidth = 8;
    const expectedPreviewWidth =
      expectedWorkspaceWidth - expectedSidebarWidth - expectedGutterWidth;

    // Two-column layout and tight desktop geometry characterization.
    expect(previewBox!.x).toBeGreaterThan(sidebarBox!.x + sidebarBox!.width - 1);
    expectWithinTolerance(sidebarBox!.width, expectedSidebarWidth);
    expectWithinTolerance(
      previewBox!.x - (sidebarBox!.x + sidebarBox!.width),
      expectedGutterWidth,
    );
    expectWithinTolerance(previewBox!.width, expectedPreviewWidth);
    await expectNoHorizontalOverflow(page);
  }
});

test("keeps the LinkedIn tooltip inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openHostedApp(page);
  await uploadMarkdownFiles(page, [
    {
      name: "linkedin-tooltip.md",
      body: "# LinkedIn tooltip\n\nToolbar tooltip should stay contained.",
    },
  ]);

  await page.getByRole("button", { name: "LinkedIn", exact: true }).focus();

  const tooltipRect = await page
    .locator("#linkedin-toggle-tooltip")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
      };
    });

  expect(tooltipRect.left).toBeGreaterThanOrEqual(0);
  expect(tooltipRect.right).toBeLessThanOrEqual(375);
  await expectNoHorizontalOverflow(page);
});

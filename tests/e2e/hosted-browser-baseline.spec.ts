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

  for (const { name } of fixtures) {
    await expect(page.getByRole("button", { name: `Open ${name}` })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `Select ${name}` })).toBeVisible();
  }
}

async function expectPreviewHeading(page: Page, name: string) {
  await expect(
    page
      .getByRole("region", { name: "Preview" })
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

test("loads hosted app regions and empty states", async ({ page }) => {
  await openHostedApp(page);

  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(
    page.getByText("Drop files or start writing.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Start with writing or drop a file.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible();
});

test("creates and edits a scratch draft", async ({ page }) => {
  await openHostedApp(page);

  await page.getByRole("button", { name: "Start writing" }).click();
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

  await page.getByRole("button", { name: "Preview" }).click();
  await expectPreviewHeading(page, "Browser baseline draft");
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

import {
  expect,
  test,
  type Page,
} from "@playwright/test";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Smoke coverage for the npm-production dep bump (PR #119): exercises every
// hosted-testable input format the major bumps touch (markdown, pdf, xlsx,
// docx) plus the Find/Replace bar that the React 19 RefObject change affects.
// Native Save / Save As / Reveal in Finder are macOS shell features and not
// reachable from the hosted bundle; see the Mac validation pattern memo.

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(HERE, "..", "..", "test-fixtures");

function readFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURE_DIR, name));
}

async function openHostedApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function uploadFixture(
  page: Page,
  fixture: { name: string; mimeType: string; buffer: Buffer },
) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(fixture);
  // Upload triggers working-mode auto-collapse (PR #121); if the upload
  // panel collapses into a rail, re-expand it so the file-list buttons
  // remain locatable. Mirrors tests/e2e/hosted-browser-baseline.spec.ts.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  await expect(showUpload).toBeVisible({ timeout: 15_000 });
  await showUpload.click();
  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  // Heavier fixtures (XLSX, PDF, DOCX) take longer on shared CI runners
  // before the file-list "Open ${name}" button mounts; widen past the 5s
  // default so this helper does not flake on slow conversion paths.
  await expect(
    page.getByRole("button", { name: `Open ${fixture.name}` }),
  ).toBeVisible({ timeout: 15_000 });
}

async function openUploadedFile(page: Page, name: string) {
  await page.getByRole("button", { name: `Open ${name}` }).click();
}

test.describe("dep bump format smoke (PR #119)", () => {
  test("renders a markdown file with react-markdown 10", async ({ page }) => {
    await openHostedApp(page);

    await uploadFixture(page, {
      name: "smoke-bump.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Bump Smoke\n\nText body.\n\n## Subsection\n\n- list one\n- list two\n",
      ),
    });

    await openUploadedFile(page, "smoke-bump.md");

    const preview = page.getByRole("region", { name: "Preview" });
    await expect(
      preview.getByRole("heading", { name: "Bump Smoke", level: 1 }),
    ).toBeVisible();
    await expect(
      preview.getByRole("heading", { name: "Subsection", level: 2 }),
    ).toBeVisible();
    await expect(preview.getByText("list one")).toBeVisible();
  });

  test("converts a PDF fixture with pdfjs-dist 5", async ({ page }) => {
    await openHostedApp(page);

    await uploadFixture(page, {
      name: "sample.pdf",
      mimeType: "application/pdf",
      buffer: readFixture("sample.pdf"),
    });

    await openUploadedFile(page, "sample.pdf");

    // The unit-test smoke expects the converted markdown to contain
    // "Sample PDF"; that lives in the Preview region after conversion.
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview.getByText(/Sample PDF/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("converts an XLSX fixture with read-excel-file v9", async ({ page }) => {
    await openHostedApp(page);

    await uploadFixture(page, {
      name: "sample.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: readFixture("sample.xlsx"),
    });

    await openUploadedFile(page, "sample.xlsx");

    const preview = page.getByRole("region", { name: "Preview" });
    // Markers from src/__tests__/smoke.test.ts:130: per-sheet heading and
    // the Projects table header row.
    await expect(
      preview.getByRole("heading", { name: /Sheet: Projects/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(preview.getByText(/Project/).first()).toBeVisible();
    await expect(preview.getByText(/Owner/).first()).toBeVisible();
    await expect(preview.getByText(/Status/).first()).toBeVisible();
  });

  test("converts a DOCX fixture under React 19", async ({ page }) => {
    await openHostedApp(page);

    await uploadFixture(page, {
      name: "sample.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: readFixture("sample.docx"),
    });

    await openUploadedFile(page, "sample.docx");

    const preview = page.getByRole("region", { name: "Preview" });
    // Marker from src/__tests__/smoke.test.ts:117: the Overview heading.
    await expect(
      preview.getByRole("heading", { name: /Overview/i, level: 1 }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("opens Find with Cmd+F and locates a match", async ({ page }) => {
    await openHostedApp(page);

    const body = "Apple Banana Cherry\n\nApple again. Apple twice.\n";
    await uploadFixture(page, {
      name: "find-target.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(body),
    });
    await openUploadedFile(page, "find-target.md");

    // Wait for the preview to populate before opening Find.
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview.getByText(/Apple Banana Cherry/i)).toBeVisible();

    // PreviewPanel wires the find shortcut on window keydown.
    await page.keyboard.press("ControlOrMeta+f");

    const findInput = page.getByRole("textbox", { name: /Find markdown text/i });
    await expect(findInput).toBeVisible();

    await findInput.fill("Apple");
    // The component renders "<n> of <total>" in a status region; assert at
    // least one match is reported.
    await expect(page.getByText(/of\s+\d+/i).first()).toBeVisible();
  });
});

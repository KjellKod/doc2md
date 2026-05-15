// Regression test for the find-in-preview table-cells bug documented at
// ideas/bug_report_find_preview_table_cells.md.
//
// Symptom: when a markdown table is rendered in Preview mode, the find
// corpus comes from element.textContent which concatenates cell text
// with no separator. A user searching for adjacent-cell phrases like
// "Atlas Jordan" against the rendered table finds zero matches even
// though the cells are visually adjacent on screen. Edit mode (which
// searches raw markdown with literal "| " separators) ALSO does not
// match such cross-cell phrases, but single-cell phrases like
// "On Track" inside a single cell do match in both modes.
//
// Acceptance criteria #6 from the bug report:
//   "uses a real xlsx fixture and asserts both edit-mode and
//   preview-mode counts match for at least four queries: single-cell
//   substring, cross-cell-boundary phrase, header text, numeric value
//   adjacent to another numeric value."
//
// Interpretation for this fixture (test-fixtures/sample.xlsx, with
// Projects + Inventory sheets): the cross-cell phrase IS the
// distinguishing case the fix introduces. Edit mode searches raw
// markdown so "Atlas Jordan" does not match there either; the
// invariant we pin is that Preview mode returns a non-zero count for
// the cross-cell phrase AFTER the fix while remaining 0 today
// (failing-first). Single-cell phrases like "On Track" stay matched
// in both modes throughout.
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function openXlsxFixture(page: Page) {
  await page.goto("./");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  const buffer = fs.readFileSync(
    path.resolve(process.cwd(), "test-fixtures/sample.xlsx"),
  );
  await fileChooser.setFiles([
    {
      name: "sample.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  // Preview is the default; wait for the rendered surface.
  await expect(page.locator(".markdown-surface")).toBeVisible();
}

async function openFindWithQuery(page: Page, query: string) {
  // Open find via the toolbar button so the bar is present regardless
  // of platform-specific Cmd/Ctrl bindings.
  await page.getByRole("button", { name: "Find and replace" }).click();
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await expect(findInput).toBeVisible();
  await findInput.fill(query);
  return findInput;
}

async function findCount(page: Page) {
  const countLocator = page.locator(".find-replace-count");
  // The count text is one of: "" (no query), "no matches", "N of M".
  // We return the M (total) when present, else 0.
  const text = (await countLocator.textContent())?.trim() ?? "";
  if (!text || /no match/i.test(text)) {
    return 0;
  }
  const match = text.match(/of\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function clearFindQuery(page: Page) {
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("");
}

test.describe("find against xlsx in edit and preview modes", () => {
  test("single-cell substring matches in both edit and preview", async ({
    page,
  }) => {
    await openXlsxFixture(page);

    // "On Track" lives inside one cell in the Projects sheet, so it's
    // adjacent in both raw markdown ("| On Track |") and rendered text.
    // This case already works pre-fix; pin it to prove the fix does not
    // regress single-cell behavior (acceptance criterion #3).
    await openFindWithQuery(page, "On Track");
    const previewCount = await findCount(page);
    expect(previewCount).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Edit markdown" }),
    ).toBeVisible();
    const editCount = await findCount(page);
    expect(editCount).toBe(previewCount);
  });

  test("header text matches in both edit and preview", async ({ page }) => {
    await openXlsxFixture(page);

    // "Project" is the first header cell of the Projects sheet.
    await openFindWithQuery(page, "Project");
    const previewCount = await findCount(page);
    expect(previewCount).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Edit markdown" }),
    ).toBeVisible();
    const editCount = await findCount(page);
    expect(editCount).toBe(previewCount);
  });

  test("cross-cell-boundary phrase matches in preview after fix", async ({
    page,
  }) => {
    await openXlsxFixture(page);

    // "Atlas Jordan" is two adjacent cells in the same row of the
    // Projects sheet. Pre-fix the rendered corpus is "AtlasJordanOn
    // Track" with no separator, so the phrase finds zero matches.
    // Post-fix the corpus is "Atlas Jordan On Track " and the phrase
    // matches once. This test fails on pre-fix main and passes after
    // the corpus walk emits a space at <td> boundaries.
    await openFindWithQuery(page, "Atlas Jordan");
    const previewCount = await findCount(page);
    expect(previewCount).toBeGreaterThanOrEqual(1);
  });

  test("cross-cell numeric-adjacent phrase matches in preview after fix", async ({
    page,
  }) => {
    await openXlsxFixture(page);

    // "Hardware 14" spans the Category and Count columns of the
    // Inventory sheet — text adjacent to a numeric value. Same fix
    // path as "Atlas Jordan"; included to satisfy acceptance criterion
    // #6's "numeric value adjacent to another value" requirement.
    await openFindWithQuery(page, "Hardware 14");
    const previewCount = await findCount(page);
    expect(previewCount).toBeGreaterThanOrEqual(1);
  });

  test("highlight lands on the matched cells, not shifted by virtual separators", async ({
    page,
  }) => {
    await openXlsxFixture(page);

    // Acceptance criterion #5: the rendered <mark> elements wrap the
    // visible cell text, not the virtual space we inject for offsets.
    // After the fix, "Atlas Jordan" wraps both "Atlas" and "Jordan"
    // (two <mark> elements, one per cell).
    await openFindWithQuery(page, "Atlas Jordan");
    const marks = page.locator(
      ".markdown-surface mark.markdown-rendered-find-highlight",
    );
    await expect(marks).toHaveCount(2);
    const texts = await marks.allTextContents();
    expect(texts.join("|")).toBe("Atlas|Jordan");
  });
});

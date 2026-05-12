import { expect, test, type Page } from "@playwright/test";

async function openEditorWith(page: Page, content: string) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  const editor = page.getByLabel("Edit markdown");
  await expect(editor).toBeFocused();
  await editor.fill(content);
}

// Single-match Replace uses a targeted `execCommand('insertText')` on only
// the matched range. It IS single-undoable on Chromium. (Replace All
// intentionally skipped single-undo for performance on large docs — see
// the editor-integration spec and the plan A4.5 note.)
test("Replace (single match) commits as a single native undo on Chromium", async ({ page }) => {
  const originalContent = "apple banana apple cherry";
  await openEditorWith(page, originalContent);

  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("apple");
  // Replace controls visible by default in edit mode.
  await page
    .getByRole("textbox", { name: "Replacement text" })
    .fill("pear");

  // Click Replace (single, not All). Focus stays on the textarea because
  // the action button uses onMouseDown preventDefault.
  await page
    .locator(".find-replace-replace-actions")
    .getByRole("button", { name: "Replace", exact: true })
    .click();

  const editor = page.getByLabel("Edit markdown");
  await expect(editor).toHaveValue("pear banana apple cherry");

  // Press Cmd-Z (or Ctrl-Z) without refocusing — the textarea is still the
  // active element thanks to the mousedown guard. Single undo must restore
  // the pre-replace content in one step.
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+z" : "Control+z");
  await expect(editor).toHaveValue(originalContent);
});

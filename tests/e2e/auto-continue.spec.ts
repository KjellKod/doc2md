import { expect, test, type Page } from "@playwright/test";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

test("auto-continues unordered bullet on Enter", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("- first item");
  await editor.press("Enter");
  await expect(editor).toHaveValue("- first item\n- ");
});

test("auto-continues ordered list with incrementing numbers", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("1. one");
  await editor.press("Enter");
  await expect(editor).toHaveValue("1. one\n2. ");
});

test("auto-continues task list as unchecked", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("- [x] done");
  await editor.press("Enter");
  await expect(editor).toHaveValue("- [x] done\n- [ ] ");
});

test("Enter on an empty bullet exits the list", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("- ");
  await editor.press("Enter");
  await expect(editor).toHaveValue("");
});

test("does not auto-continue while IME composition is active", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("- foo");

  // Synthetic IME composition via page.evaluate so we hit the
  // isComposing guard in the keydown handler.
  await page.evaluate(() => {
    const ta = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement;
    ta.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      } as KeyboardEventInit),
    );
  });

  // No marker insertion should have occurred while composing.
  await expect(editor).toHaveValue("- foo");

  // End composition; a real Enter now auto-continues.
  await page.evaluate(() => {
    const ta = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement;
    ta.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });

  await editor.focus();
  await editor.press("End");
  await editor.press("Enter");
  await expect(editor).toHaveValue("- foo\n- ");
});

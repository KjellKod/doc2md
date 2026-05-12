import { expect, test, type Page } from "@playwright/test";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

async function selectAll(page: Page) {
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+a" : "Control+a");
}

async function selectRange(page: Page, start: number, end: number) {
  await page.evaluate(
    ({ start, end }) => {
      const ta = document.querySelector(
        "textarea.markdown-edit-area",
      ) as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(start, end);
    },
    { start, end },
  );
}

test("Cmd-B wraps the selection in bold", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("hello world");
  await selectRange(page, 6, 11);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+b" : "Control+b");
  await expect(editor).toHaveValue("hello **world**");
});

test("Cmd-I wraps the selection in italics", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("italic word");
  await selectRange(page, 7, 11);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+i" : "Control+i");
  await expect(editor).toHaveValue("italic _word_");
});

test("Cmd-K inserts a link skeleton at the caret", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("hi");
  await selectRange(page, 2, 2);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+k" : "Control+k");
  await expect(editor).toHaveValue("hi[](url)");
});

test("Cmd-Shift-8 toggles an unordered list across selected lines", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("alpha\nbeta\ngamma");
  await selectAll(page);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+Shift+8" : "Control+Shift+8");
  await expect(editor).toHaveValue("- alpha\n- beta\n- gamma");
});

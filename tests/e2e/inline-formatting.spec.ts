import { expect, test, type Page } from "@playwright/test";
import { openShortcutsReference } from "./helpers/findBar";

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

test("shortcut reference is reachable and dismisses with Escape", async ({
  page,
  isMobile,
}) => {
  await openScratchEditor(page);
  await openShortcutsReference(page);

  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Find");
  await expect(dialog).toContainText("Cmd/Ctrl+F");
  await expect(dialog).toContainText("Bold");
  await expect(dialog).toContainText("Cmd/Ctrl+B");
  await expect(dialog).toContainText("Italic");
  await expect(dialog).toContainText("Cmd/Ctrl+I");
  await expect(dialog).toContainText("Link");
  await expect(dialog).toContainText("Cmd/Ctrl+K");
  await expect(dialog).toContainText("Ordered list");
  await expect(dialog).toContainText("Cmd/Ctrl+Shift+7");
  await expect(dialog).toContainText("Bulleted list");
  await expect(dialog).toContainText("Cmd/Ctrl+Shift+8");
  await expect(dialog).toContainText("Task list");
  await expect(dialog).toContainText("Cmd/Ctrl+Shift+9");
  await expect(dialog).toContainText("Close find or menu");
  await expect(dialog).toContainText("Escape");
  await expect(dialog).not.toContainText("Save document");

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  // Focus-return-to-trigger is a desktop-toolbar a11y contract (the trigger is
  // the persistent "Keyboard shortcuts" button). On hosted phones (P1) the
  // trigger is an overflow-menu item that no longer exists once the popover
  // opened, so the focus-return target is layout-specific — assert it only
  // where the direct trigger persists.
  if (!isMobile) {
    await expect(
      page.getByRole("button", { name: "Keyboard shortcuts" }),
    ).toBeFocused();
  }
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

test("Cmd-Shift-7 toggles an ordered list across selected lines", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("alpha\nbeta\ngamma");
  await selectAll(page);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+Shift+7" : "Control+Shift+7");
  await expect(editor).toHaveValue("1. alpha\n2. beta\n3. gamma");
});

test("Cmd-Shift-9 toggles a task list across selected lines", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("alpha\nbeta\ngamma");
  await selectAll(page);
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+Shift+9" : "Control+Shift+9");
  await expect(editor).toHaveValue("- [ ] alpha\n- [ ] beta\n- [ ] gamma");
});

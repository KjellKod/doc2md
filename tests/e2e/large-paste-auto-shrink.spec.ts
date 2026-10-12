import { expect, test, type Page } from "@playwright/test";

// Drafts enter the workspace immediately, independent of paste length.

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

async function pastePlainText(page: Page, plainText: string) {
  const useNativeInsertion = await page.getByLabel("Edit markdown").evaluate((node, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    return node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, plainText);
  // Synthetic clipboard events do not perform the browser default insertion.
  if (useNativeInsertion) await page.keyboard.insertText(plainText);
}

for (const body of ["short note", "x".repeat(201)]) {
  test(`pasting ${body.length} characters preserves the focused workspace`, async ({ page }) => {
    await openScratchEditor(page);
    await expect(page.locator(".page")).toHaveClass(/is-working-mode/);
    await pastePlainText(page, body);
    await expect(page.getByLabel("Edit markdown")).toHaveValue(body);
    await expect(page.getByLabel("Edit markdown")).toBeFocused();
    await expect(page.locator(".combined-toolbar")).toBeVisible();
    await expect(page.locator(".hero")).toHaveCount(0);
  });
}

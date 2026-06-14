import { expect, type Page } from "@playwright/test";

/**
 * Reveal the Find / Find-and-replace bar in a layout-agnostic way.
 *
 * On desktop and bare shells the toolbar shows a direct "Find and replace"
 * button. On hosted phones (P1 compact toolbar fold) Find is demoted behind the
 * single overflow "More" menu, so the direct button is not present. This helper
 * clicks the direct button when it exists, otherwise opens the overflow menu and
 * activates the "Find and replace" menu item — exercising the same find feature
 * on both layouts without each spec needing to branch on viewport.
 */
export async function openFindBar(page: Page): Promise<void> {
  const directFind = page.getByRole("button", { name: "Find and replace" });
  if (await directFind.count()) {
    await directFind.first().click();
    return;
  }

  // Compact (hosted-phone) layout: Find lives in the overflow menu.
  const more = page.getByRole("button", { name: "More actions" });
  await expect(more).toBeVisible();
  await more.click();
  await page
    .getByRole("menu", { name: "More actions" })
    .getByRole("menuitem", { name: "Find and replace" })
    .click();
}

/**
 * Open the keyboard-shortcuts reference popover in a layout-agnostic way. On
 * desktop the toolbar shows a direct "Keyboard shortcuts" button; on hosted
 * phones it is demoted into the overflow "More" menu (P1).
 */
export async function openShortcutsReference(page: Page): Promise<void> {
  const directButton = page.getByRole("button", { name: "Keyboard shortcuts" });
  if (await directButton.count()) {
    await directButton.first().click();
    return;
  }

  const more = page.getByRole("button", { name: "More actions" });
  await expect(more).toBeVisible();
  await more.click();
  await page
    .getByRole("menu", { name: "More actions" })
    .getByRole("menuitem", { name: "Keyboard shortcuts" })
    .click();
}

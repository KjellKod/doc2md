import { expect, type Page } from "@playwright/test";

/** Find stays in the toolbar, or moves into Settings on narrow phones. */
export async function openFindBar(page: Page): Promise<void> {
  const directFind = page.getByRole("button", { name: "Find and replace" });
  if (await directFind.isVisible()) {
    await directFind.click();
    return;
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Find and replace" }).click();
}

/** The single Settings panel contains the expandable shortcuts reference. */
export async function openShortcutsReference(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const reference = page.locator(".combined-shortcuts");
  await expect(reference).toBeVisible();
  await reference.locator("summary").click();
}

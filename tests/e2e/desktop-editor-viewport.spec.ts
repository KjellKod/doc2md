import { expect, test } from "@playwright/test";

// Run the actual desktop entry; only native file/persistence I/O is mocked.
test.beforeEach(async ({ page }) => {
  await page.route("**/doc2md/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "/src/main.tsx",
        "/src/desktop/main.tsx",
      ),
    });
  });
  await page.addInitScript(() => {
    window.doc2mdShell = {
      version: 2,
      getPersistenceSettings: async () => ({
        ok: true,
        persistenceEnabled: false,
        recentFiles: [],
      }),
      setPersistenceEnabled: async ({ enabled }) => ({
        ok: true,
        persistenceEnabled: enabled,
        recentFiles: [],
      }),
      setPersistenceTheme: async ({ theme }) => ({
        ok: true,
        persistenceEnabled: false,
        recentFiles: [],
        theme,
      }),
      setSessionState: async (args) => ({ ok: true, recentFiles: [], ...args }),
      getSessionState: async () => ({
        ok: true,
        openPaths: [],
        recentFiles: [],
      }),
      openFile: async () => ({
        ok: false,
        code: "error",
        message: "Cannot read this file.",
      }),
      saveFile: async () => ({ ok: false, code: "cancelled" }),
      saveFileAs: async () => ({ ok: false, code: "cancelled" }),
      revealInFinder: async () => ({ ok: false, code: "cancelled" }),
      statFile: async () => ({ ok: false, code: "cancelled" }),
    };
  });
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("./");
  await page
    .getByRole("button", { name: "New document", exact: true })
    .first()
    .click();
});

test("desktop editor fits after window growth and shrink, with scrolling inside the document", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: "Edit markdown" });
  for (const height of [700, 1100, 600]) {
    await page.setViewportSize({ width: 1280, height });
    await expect
      .poll(async () => {
        const bounds = await editor.boundingBox();
        return bounds ? bounds.y + bounds.height : Infinity;
      })
      .toBeLessThanOrEqual(height - 4);
  }
  await editor.fill(
    Array.from({ length: 160 }, (_, i) => `Line ${i + 1}`).join("\n"),
  );
  await editor.hover();
  await page.mouse.wheel(0, 10000);
  await expect
    .poll(() => editor.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(601);
});

test("desktop file errors stay visible without pushing the editor below the window", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open files", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot read this file.");
  const bounds = await page
    .getByRole("textbox", { name: "Edit markdown" })
    .boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(696);
});

for (const width of [900, 979]) {
  test(`narrow desktop at ${width}px reserves remaining height for the editor`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    const editor = page.getByRole("textbox", { name: "Edit markdown" });
    const sidebar = page.locator(".sidebar-panel");
    await expect(sidebar).toBeVisible();
    await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(280);
    const expanded = await editor.boundingBox();
    const files = await sidebar.boundingBox();
    expect(expanded!.y).toBeLessThanOrEqual(files!.y + files!.height + 20);
    expect(expanded!.y + expanded!.height).toBeLessThanOrEqual(700);
    await page.getByRole("button", { name: "Hide files", exact: true }).click();
    await expect(sidebar).toBeHidden();
    await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(500);
    await page.getByRole("button", { name: "Show files", exact: true }).click();
    await expect(sidebar).toBeVisible();
    await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(280);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(701);
  });
}

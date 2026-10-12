import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function revealFiles(page: Page) {
  const showFiles = page.getByRole("button", { name: "Show files" });
  if (await showFiles.isVisible()) {
    await showFiles.click();
  }
}

test("a draft enters the workspace and downloads one clearly named Markdown copy", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.locator(".page")).toHaveClass(/is-working-mode/);
  const editor = page.getByRole("textbox", { name: "Edit markdown" });
  await expect(editor).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Download Markdown", exact: true }),
  ).toBeDisabled();

  const body = "# Review notes\n\nA local draft ready for the next step.";
  await editor.fill(body);
  await expect(
    page.getByRole("button", { name: "Download Markdown", exact: true }),
  ).toBeEnabled();
  const downloadButton = page.getByRole("button", {
    name: "Download Markdown",
    exact: true,
  });
  await expect(downloadButton).toHaveCount(1);
  await expect(downloadButton).toBeInViewport();
  await expect(page.getByRole("button", { name: "Save document" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "LinkedIn", exact: true }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const file = await download.path();
  expect(file).not.toBeNull();
  expect(await readFile(file!, "utf8")).toBe(body);
  await expect(page.locator(".save-state-pill")).toHaveText(
    /^Download started/,
  );
  await page.screenshot({
    path: testInfo.outputPath("working-draft.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "About doc2md", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "About doc2md" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveValue(body);
});

test("canceling Clear preserves a draft and accepting discards it", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: "Edit markdown" });
  await editor.fill("# Keep this draft");
  await revealFiles(page);

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toMatch(/discard/i);
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Clear active file" }).click();
  await expect(editor).toHaveValue("# Keep this draft");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear active file" }).click();
  await expect(page.getByText("No files or drafts yet.")).toBeVisible();
  await expect(page.locator(".page")).not.toHaveClass(/is-working-mode/);
});

test("renames the Markdown output inline and keeps settings preferences together", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "New document", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Edit markdown" });
  await editor.fill("# Keep my text");
  await page
    .getByRole("button", { name: /^Rename document:/ })
    .click();
  await page
    .getByRole("textbox", { name: "Document name", exact: true })
    .fill("Renamed notes");
  await page
    .getByRole("textbox", { name: "Document name", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", { name: /^Rename document:/ }),
  ).toHaveText("Renamed notes.md");
  await expect(editor).toHaveValue("# Keep my text");
  await page
    .getByRole("button", { name: /^Rename document:/ })
    .click();
  await page
    .getByRole("textbox", { name: "Document name", exact: true })
    .fill("Discard this");
  await page
    .getByRole("textbox", { name: "Document name", exact: true })
    .press("Escape");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Markdown", exact: true })
    .click();
  expect((await pending).suggestedFilename()).toBe("Renamed notes.md");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Line numbers", exact: true })
    .check();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("dark");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Line numbers", exact: true }),
  ).toBeChecked();
});

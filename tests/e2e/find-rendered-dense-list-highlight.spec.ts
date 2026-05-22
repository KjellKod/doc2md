import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const DENSE_METADATA = [
  "Name: Alpha Beta",
  "Role: Gamma Delta",
  "Email: x@example.com",
  "Phone: 1234567890",
].join("\n");

async function openMarkdown(page: Page) {
  await page.goto("./");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: "dense-metadata.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(DENSE_METADATA),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await expect(page.locator(".markdown-surface li")).toHaveCount(4);
}

test("preview find highlights the searched word inside formatted metadata lists", async ({
  page,
}) => {
  await openMarkdown(page);

  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("Gamma");
  await expect(page.locator(".find-replace-count")).toHaveText("1 of 1");

  const renderedMark = page.locator(
    ".markdown-surface mark.markdown-rendered-find-highlight",
  );
  await expect(renderedMark).toHaveCount(1);
  await expect(renderedMark).toHaveText("Gamma");
});

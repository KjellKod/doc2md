import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const FENCED_XML = [
  "# Launch Agent",
  "",
  "[Repository guide](../README.md)",
  "",
  "```xml",
  "<dict>",
  "  <key>RunAtLoad</key>",
  "  <true/>",
  "</dict>",
  "```",
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
      name: "launch-agent.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(FENCED_XML),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await expect(page.locator(".markdown-surface code")).toContainText(
    "RunAtLoad",
  );
}

test("find keeps fenced XML highlight aligned after edit-to-preview source switch", async ({
  page,
}) => {
  await openMarkdown(page);

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Find and replace" }).click();
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("RunAtLoad");
  await expect(page.locator(".find-replace-count")).toHaveText("1 of 1");
  await expect(page.locator(".markdown-find-highlight")).toHaveText(
    "RunAtLoad",
  );

  await page.getByRole("button", { name: "View", exact: true }).click();
  const renderedMark = page.locator(
    ".markdown-surface mark.markdown-rendered-find-highlight",
  );
  await expect(renderedMark).toHaveCount(1);
  await expect(renderedMark).toHaveText("RunAtLoad");
});

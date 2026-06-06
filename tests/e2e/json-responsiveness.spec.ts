import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";

const ONFLEET_INVENTORY =
  "/Users/kjell/Downloads/RepoLens/Onfleet/inventory.json";

async function openHostedApp(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

function createGeneratedInventoryFixture() {
  const rows = Array.from({ length: 35_000 }, (_, index) => ({
    id: `pkg-${index}`,
    name: `Package ${index}`,
    version: `${index % 25}.${index % 10}.${index % 7}`,
    source: index % 2 === 0 ? "npm" : "pypi",
    license: index % 5 === 0 ? "MIT" : "Apache-2.0",
  }));

  return Buffer.from(JSON.stringify({ inventory: rows }));
}

function loadLargeJsonFixture() {
  if (existsSync(ONFLEET_INVENTORY)) {
    return {
      name: "inventory.json",
      mimeType: "application/json",
      buffer: readFileSync(ONFLEET_INVENTORY),
    };
  }

  return {
    name: "generated-inventory.json",
    mimeType: "application/json",
    buffer: createGeneratedInventoryFixture(),
  };
}

async function startHeartbeat(page: Page) {
  await page.evaluate(() => {
    const windowWithHeartbeat = window as typeof window & {
      __jsonResponsivenessHeartbeat?: number;
      __jsonResponsivenessInterval?: number;
    };
    windowWithHeartbeat.__jsonResponsivenessHeartbeat = 0;
    if (windowWithHeartbeat.__jsonResponsivenessInterval) {
      window.clearInterval(windowWithHeartbeat.__jsonResponsivenessInterval);
    }
    windowWithHeartbeat.__jsonResponsivenessInterval = window.setInterval(() => {
      windowWithHeartbeat.__jsonResponsivenessHeartbeat =
        (windowWithHeartbeat.__jsonResponsivenessHeartbeat ?? 0) + 1;
    }, 20);
  });
}

async function heartbeat(page: Page) {
  return page.evaluate(() => {
    const windowWithHeartbeat = window as typeof window & {
      __jsonResponsivenessHeartbeat?: number;
    };
    return windowWithHeartbeat.__jsonResponsivenessHeartbeat ?? 0;
  });
}

test.describe("large JSON responsiveness", () => {
  test("keeps hosted import, view switch, and downloads responsive", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium" || testInfo.project.name !== "chromium",
      "Large JSON responsiveness proof runs once in desktop Chromium.",
    );

    await openHostedApp(page);
    await startHeartbeat(page);

    const beforeImportHeartbeat = await heartbeat(page);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "browse from your device", exact: true })
      .click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(loadLargeJsonFixture());

    await expect(page.getByTestId("large-json-preview")).toBeVisible({
      timeout: 30_000,
    });
    expect(await heartbeat(page)).toBeGreaterThan(beforeImportHeartbeat);

    const editButton = page.getByRole("button", { name: "Edit" });
    const viewButton = page.getByRole("button", { name: "View" });
    await editButton.click();
    await expect(page.getByLabel("Edit markdown")).toBeVisible();

    const switchStarted = await page.evaluate(() => performance.now());
    await viewButton.click();
    await expect(page.getByTestId("large-json-preview")).toBeVisible();
    const switchElapsed = await page.evaluate((started) => {
      return performance.now() - started;
    }, switchStarted);
    expect(switchElapsed).toBeLessThan(500);

    const saveButton = page.getByRole("button", { name: "Save document" });
    const beforeSaveHeartbeat = await heartbeat(page);
    const saveDownloadPromise = page.waitForEvent("download");
    await saveButton.click();
    await expect(saveButton).toHaveAttribute("aria-busy", "true");
    await saveDownloadPromise;
    await expect(saveButton).toHaveAttribute("aria-busy", "false");
    expect(await heartbeat(page)).toBeGreaterThan(beforeSaveHeartbeat);

    const markdownButton = page.getByRole("button", {
      name: "Download Markdown",
    });
    const beforeMarkdownHeartbeat = await heartbeat(page);
    const markdownDownloadPromise = page.waitForEvent("download");
    await markdownButton.click();
    await expect(markdownButton).toHaveAttribute("aria-busy", "true");
    await markdownDownloadPromise;
    await expect(markdownButton).toHaveAttribute("aria-busy", "false");
    expect(await heartbeat(page)).toBeGreaterThan(beforeMarkdownHeartbeat);

    const htmlButton = page.getByRole("button", { name: "Download HTML" });
    const beforeHtmlHeartbeat = await heartbeat(page);
    const htmlDownloadPromise = page.waitForEvent("download");
    await htmlButton.click();
    await expect(htmlButton).toHaveAttribute("aria-busy", "true");
    await htmlDownloadPromise;
    await expect(htmlButton).toHaveAttribute("aria-busy", "false");
    expect(await heartbeat(page)).toBeGreaterThan(beforeHtmlHeartbeat);
  });
});

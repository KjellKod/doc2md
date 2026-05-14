import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const SURFACE_CONSTRAINT = `
  .markdown-surface,
  .linkedin-surface,
  .markdown-edit-shell {
    max-height: 520px !important;
  }
  .markdown-find-overlay,
  .markdown-edit-area {
    max-height: 520px !important;
  }
`;

const ASCII_FIXTURE = [
  "# Characterization",
  "",
  "Alpha marker begins this plain paragraph.",
  "",
  "This long plain ASCII paragraph keeps a stable word across rendered preview, raw edit text, and LinkedIn unicode formatting. The anchor target phrase appears here after enough ordinary text to wrap softly in the constrained surface. The sentence continues with neutral words so the mode switch has real scroll work to preserve without relying on non ASCII glyphs.",
  "",
  "Another alpha marker closes the document.",
].join("\n");

async function openMarkdown(page: Page, body = ASCII_FIXTURE) {
  await page.goto("./");
  await page.addStyleTag({ content: SURFACE_CONSTRAINT });
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: "preview-panel-characterization.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(body),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await expect(
    page.getByRole("heading", { name: "Characterization" }),
  ).toBeVisible();
}

async function openFindWithQuery(page: Page, query: string) {
  await page.keyboard.press("ControlOrMeta+f");
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await expect(findInput).toBeVisible();
  await findInput.fill(query);
  await expect(page.locator(".find-replace-count")).toHaveText(/of \d+/);
  return findInput;
}

async function renderedTopSourceLine(page: Page, selector: string) {
  return page.evaluate((surfaceSelector) => {
    const surface = document.querySelector(
      surfaceSelector,
    ) as HTMLElement | null;
    if (!surface) {
      return 1;
    }
    const stamped = Array.from(
      surface.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
    const top = surface.getBoundingClientRect().top;
    for (const element of stamped) {
      if (element.getBoundingClientRect().top >= top - 4) {
        return Number(element.dataset.sourceLine);
      }
    }
    return Number(stamped.at(-1)?.dataset.sourceLine ?? 1);
  }, selector);
}

async function editorTopSourceLine(page: Page) {
  return page.evaluate(() => {
    const textarea = document.querySelector(
      'textarea[aria-label="Edit markdown"]',
    ) as HTMLTextAreaElement | null;
    const mirror = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLElement | null;
    if (!textarea || !mirror) {
      return 1;
    }
    mirror.scrollTop = textarea.scrollTop;
    const source = textarea.value;
    const top = mirror.getBoundingClientRect().top;
    const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let current = walker.nextNode() as Text | null;
    while (current) {
      for (let index = 0; index < current.data.length; index += 1) {
        const range = document.createRange();
        range.setStart(current, index);
        range.setEnd(current, Math.min(index + 1, current.data.length));
        const rect = range.getBoundingClientRect();
        if (rect.top !== 0 && rect.top >= top - 4) {
          return source.slice(0, offset + index).split("\n").length;
        }
      }
      offset += current.data.length;
      current = walker.nextNode() as Text | null;
    }
    return 1;
  });
}

test.describe("PreviewPanel refactor characterization", () => {
  test("find mark is scoped to the active mode tree across mode switches", async ({
    page,
  }) => {
    await openMarkdown(page);
    await openFindWithQuery(page, "Alpha");

    await expect(page.locator(".markdown-surface")).toHaveCount(1);
    await expect(page.locator(".markdown-surface mark")).toHaveCount(1);
    await expect(page.locator(".markdown-find-overlay mark")).toHaveCount(0);
    await expect(page.locator(".linkedin-surface mark")).toHaveCount(0);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator(".markdown-surface")).toHaveCount(0);
    await expect(page.locator(".markdown-find-overlay mark")).toHaveCount(1);
    await expect(page.locator(".linkedin-surface mark")).toHaveCount(0);

    await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
    await expect(page.locator(".markdown-surface")).toHaveCount(0);
    await expect(page.locator(".markdown-find-overlay mark")).toHaveCount(0);
    await expect(page.locator(".linkedin-surface mark")).toHaveCount(1);
  });

  test("anchor survives a switch from preview to edit on a soft-wrapped paragraph", async ({
    page,
  }) => {
    await openMarkdown(page);
    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 240;
      }
    });
    const captured = await renderedTopSourceLine(page, ".markdown-surface");

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Edit markdown" })).toBeVisible();

    const landed = await editorTopSourceLine(page);
    expect(Math.abs(landed - captured)).toBeLessThanOrEqual(3);
  });

  test("edit-mode typing leaves no edit highlight marks in preview", async ({
    page,
  }) => {
    await openMarkdown(page);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await openFindWithQuery(page, "Alpha");
    await expect(page.locator(".markdown-find-overlay mark")).toHaveCount(1);

    const textarea = page.getByRole("textbox", { name: "Edit markdown" });
    await textarea.click();
    await textarea.press("Home");
    await textarea.type("Typed prefix. ");

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator(".markdown-surface")).toHaveCount(1);
    await expect(page.locator(".markdown-find-overlay")).toHaveCount(0);
    await expect(page.locator(".markdown-surface .markdown-find-highlight")).toHaveCount(0);
  });

  test("Cmd+F preserves the query across mode switch and re-runs search", async ({
    page,
  }) => {
    await openMarkdown(page);
    const findInput = await openFindWithQuery(page, "marker");
    await expect(page.locator(".find-replace-count")).toHaveText("1 of 2");

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(findInput).toHaveValue("marker");
    await expect(page.locator(".find-replace-count")).toHaveText("1 of 2");
    await expect(page.locator(".markdown-find-overlay mark")).toHaveCount(1);

    await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
    await expect(findInput).toHaveValue("marker");
    await expect(page.locator(".find-replace-count")).toHaveText("1 of 2");
    await expect(page.locator(".linkedin-surface mark")).toHaveCount(1);
  });

  test("LinkedIn refusal interlude preserves the pending anchor across the round trip", async ({
    page,
  }) => {
    // The markdown table forces a LinkedIn refusal screen (no .linkedin-surface
    // is rendered), so applyAnchorLine returns false on the LinkedIn mount and
    // the pending anchor MUST be preserved for the Preview mount to consume.
    // Trailing paragraphs give the rendered surface enough height to scroll.
    const fixture = [
      "# Characterization",
      "",
      "| Name | Role |",
      "| --- | --- |",
      "| Anna | Admin |",
      "",
      ...Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}.`),
    ].join("\n");
    await openMarkdown(page, fixture);

    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 200;
      }
    });
    const captured = await renderedTopSourceLine(page, ".markdown-surface");

    await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
    await expect(
      page.getByText("LinkedIn view is unavailable for Markdown tables."),
    ).toBeVisible();
    await expect(page.locator(".linkedin-surface")).toHaveCount(0);

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator(".markdown-surface")).toHaveCount(1);

    const landed = await renderedTopSourceLine(page, ".markdown-surface");
    expect(Math.abs(landed - captured)).toBeLessThanOrEqual(3);
  });
});

import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const EPSILON_PX = 32;

function buildLongMarkdown(): string {
  const sections: string[] = [];
  const sectionLetters = ["A", "B", "C", "D", "E", "F"];
  for (const letter of sectionLetters) {
    sections.push(`## Section ${letter}`);
    sections.push("");
    for (let p = 0; p < 8; p += 1) {
      sections.push(
        `Section ${letter} paragraph ${p + 1}. The quick brown fox jumps over the lazy dog. Repeated prose to add height to this section so the viewport-anchor algorithm has something to lock onto.`,
      );
      sections.push("");
    }
  }
  return sections.join("\n");
}

const FIXTURE_NAME = "anchor-fixture.md";
const FIXTURE_BODY = buildLongMarkdown();

// In the hosted web layout the page itself scrolls; the markdown-surface,
// linkedin-surface, and edit shell only scroll when constrained. The
// desktop shell constrains them via WKWebView; in headless Chromium we
// pin a max-height so anchor scrolling has a viewport to act on.
const SURFACE_CONSTRAINT = `
  .markdown-surface,
  .linkedin-surface,
  .markdown-edit-shell {
    max-height: 600px !important;
  }
  .markdown-find-overlay,
  .markdown-edit-area {
    max-height: 600px !important;
  }
`;

async function openFixture(page: Page) {
  await page.goto("./");
  await page.addStyleTag({ content: SURFACE_CONSTRAINT });
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: FIXTURE_NAME,
      mimeType: "text/markdown",
      buffer: Buffer.from(FIXTURE_BODY),
    },
  ]);
  await expect(
    page.getByRole("button", { name: `Open ${FIXTURE_NAME}` }),
  ).toBeVisible();
}

async function previewSurface(page: Page) {
  return page.locator(".markdown-surface");
}

async function linkedinSurface(page: Page) {
  return page.locator(".linkedin-surface");
}

async function editorTextarea(page: Page) {
  return page.getByRole("textbox", { name: "Edit markdown" });
}

async function topRenderedSourceLine(
  page: Page,
  selector: string,
): Promise<number> {
  return page.evaluate((selectorRaw) => {
    const container = document.querySelector(selectorRaw) as HTMLElement | null;
    if (!container) {
      return 1;
    }
    const stamped = Array.from(
      container.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
    if (stamped.length === 0) {
      return 1;
    }
    const containerTop = container.getBoundingClientRect().top;
    const epsilon = 4;
    for (const element of stamped) {
      const rect = element.getBoundingClientRect();
      if (rect.top >= containerTop - epsilon) {
        const isBlank = (element.textContent ?? "").trim().length === 0;
        if (!isBlank) {
          return Number(element.dataset.sourceLine);
        }
      }
    }
    return Number(stamped[stamped.length - 1].dataset.sourceLine);
  }, selector);
}

async function topElementYDelta(
  page: Page,
  selector: string,
  sourceLine: number,
): Promise<number> {
  return page.evaluate(
    ({ selector: sel, line }) => {
      const container = document.querySelector(sel) as HTMLElement | null;
      if (!container) {
        return 0;
      }
      const containerTop = container.getBoundingClientRect().top;
      // Prefer the topmost stamped element within the visible viewport;
      // fall back to the closest stamped line at or after the captured
      // anchor (mirroring how scrollRenderedToLine resolves anchors when
      // line-map elision moves the exact stamp slightly).
      const stamped = Array.from(
        container.querySelectorAll<HTMLElement>("[data-source-line]"),
      );
      let bestDelta = Number.POSITIVE_INFINITY;
      let bestAnchor: HTMLElement | null = null;
      for (const element of stamped) {
        const value = Number(element.dataset.sourceLine);
        if (value < line) {
          continue;
        }
        const delta = Math.abs(
          element.getBoundingClientRect().top - containerTop,
        );
        if (delta < bestDelta) {
          bestDelta = delta;
          bestAnchor = element;
        }
      }
      if (!bestAnchor) {
        return Number.POSITIVE_INFINITY;
      }
      return (
        bestAnchor.getBoundingClientRect().top - containerTop
      );
    },
    { selector, line: sourceLine },
  );
}

// Reads the actual top *source* line in the editor by mirroring what
// PreviewPanel's `topLineFromTextareaMirror` helper does in production:
// sync the find-overlay mirror's scrollTop to the textarea, walk the
// mirror's text nodes, and count newlines up to the first character whose
// bounding-rect top is at or below the mirror's container top. Soft-wrap
// in long paragraphs makes a per-pixel "approximate line" proxy useless;
// this returns the canonical source line.
async function topSourceLineFromEditor(page: Page): Promise<number> {
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
    const containerTop = mirror.getBoundingClientRect().top;
    const epsilon = 4;
    const source = textarea.value;
    const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
    let textOffset = 0;
    let current = walker.nextNode() as Text | null;
    let lastOffset = 0;
    let lastSeenTop = -Infinity;
    while (current) {
      const length = current.data.length;
      for (let index = 0; index < length; index += 1) {
        const range = document.createRange();
        range.setStart(current, index);
        range.setEnd(current, Math.min(index + 1, length));
        const rect = range.getBoundingClientRect();
        if (rect.top === 0 && rect.bottom === 0 && rect.left === 0) {
          continue;
        }
        lastSeenTop = rect.top;
        lastOffset = textOffset + index;
        if (rect.top >= containerTop - epsilon) {
          return source.slice(0, textOffset + index).split("\n").length;
        }
      }
      textOffset += length;
      current = walker.nextNode() as Text | null;
    }
    if (lastSeenTop !== -Infinity) {
      return source.slice(0, lastOffset).split("\n").length;
    }
    return 1;
  });
}

test.describe("view anchor mode switch", () => {
  test("preview -> edit lands on the captured source line", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Preview" }).click();

    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 1200;
      }
    });

    const captured = await topRenderedSourceLine(page, ".markdown-surface");
    expect(captured).toBeGreaterThan(1);

    await page.getByRole("button", { name: "Edit" }).click();
    await editorTextarea(page).then((textarea) => textarea.waitFor());
    const editorTopLine = await topSourceLineFromEditor(page);

    // The captured source line should be at or near the top of the
    // editor's viewport. Block-level anchoring + soft-wrap rounding can
    // shift by a couple of source lines but no more.
    expect(Math.abs(editorTopLine - captured)).toBeLessThanOrEqual(3);
  });

  test("edit -> preview lands on the captured source line within 32 px", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Edit" }).click();
    const editor = await editorTextarea(page);
    await editor.evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      textarea.scrollTop = 800;
    });
    const captured = await topSourceLineFromEditor(page);

    await page.getByRole("button", { name: "Preview" }).click();
    await (await previewSurface(page)).waitFor();

    const delta = await topElementYDelta(
      page,
      ".markdown-surface",
      captured,
    );
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("edit -> linkedin lands on the captured source line within 32 px", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Edit" }).click();
    const editor = await editorTextarea(page);
    await editor.evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      textarea.scrollTop = 600;
    });
    const captured = await topSourceLineFromEditor(page);

    await page.getByRole("button", { name: "LinkedIn" }).click();
    await (await linkedinSurface(page)).waitFor();

    const delta = await topElementYDelta(
      page,
      ".linkedin-surface",
      captured,
    );
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("preview -> linkedin lands within 32 px of the captured source line", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Preview" }).click();
    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 1100;
      }
    });
    const captured = await topRenderedSourceLine(page, ".markdown-surface");

    await page.getByRole("button", { name: "LinkedIn" }).click();
    await (await linkedinSurface(page)).waitFor();

    const delta = await topElementYDelta(
      page,
      ".linkedin-surface",
      captured,
    );
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("anchor survives a workspace resize between switches", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Edit" }).click();
    const editor = await editorTextarea(page);
    await editor.evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      textarea.scrollTop = 1000;
    });
    const captured = await topSourceLineFromEditor(page);

    // Programmatically shrink the workspace via the page-max-width custom
    // property (no slider drag in headless Chromium).
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--page-max-width", "1100px");
    });

    await page.getByRole("button", { name: "Preview" }).click();
    await (await previewSurface(page)).waitFor();

    const delta = await topElementYDelta(page, ".markdown-surface", captured);
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("preview -> edit -> preview round-trip preserves the anchor line", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Preview" }).click();
    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 900;
      }
    });
    const captured = await topRenderedSourceLine(page, ".markdown-surface");

    await page.getByRole("button", { name: "Edit" }).click();
    await editorTextarea(page).then((textarea) => textarea.waitFor());

    await page.getByRole("button", { name: "Preview" }).click();
    await (await previewSurface(page)).waitFor();

    const delta = await topElementYDelta(page, ".markdown-surface", captured);
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("LinkedIn refusal screen does not corrupt the captured anchor", async ({
    page,
  }) => {
    await page.goto("./");
    await page.addStyleTag({ content: SURFACE_CONSTRAINT });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "browse from your device", exact: true })
      .click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "table-fixture.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(
          [
            "# Table fixture",
            "",
            "| Name | Role |",
            "| --- | --- |",
            "| Anna | Admin |",
            "",
            ...Array.from(
              { length: 30 },
              (_, index) => `Paragraph ${index + 1}.\n`,
            ),
          ].join("\n"),
        ),
      },
    ]);

    await page.getByRole("button", { name: "Preview" }).click();
    await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      if (surface) {
        surface.scrollTop = 200;
      }
    });
    const captured = await topRenderedSourceLine(page, ".markdown-surface");

    await page.getByRole("button", { name: "LinkedIn" }).click();
    // Refusal screen renders.
    await expect(
      page.getByText("LinkedIn view is unavailable for Markdown tables."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Preview" }).click();
    await (await previewSurface(page)).waitFor();

    const delta = await topElementYDelta(page, ".markdown-surface", captured);
    expect(Math.abs(delta)).toBeLessThanOrEqual(EPSILON_PX);
  });

  test("rendered surface stamps each top-level block with data-source-line", async ({
    page,
  }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Preview" }).click();

    const stampedCount = await page.evaluate(() => {
      const surface = document.querySelector(
        ".markdown-surface",
      ) as HTMLElement | null;
      return surface
        ? surface.querySelectorAll("[data-source-line]").length
        : 0;
    });

    expect(stampedCount).toBeGreaterThan(0);
  });
});

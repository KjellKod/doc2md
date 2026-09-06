import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const FIXTURE_NAME = "markdown-anchor-navigation.md";
const SURFACE_CONSTRAINT = `
  .markdown-surface {
    max-height: 600px !important;
  }
`;

function filler(label: string, count: number): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `${label} paragraph ${index + 1}. Enough prose to make the preview surface scroll independently.`,
  ).join("\n\n");
}

const FIXTURE_BODY = `[Explicit target](#explicit-target)

[Generated heading](#generated-heading)

${filler("Before explicit", 24)}

<a id="explicit-target"></a>

### Explicit destination

${filler("Between targets", 24)}

### Generated heading

${filler("After generated", 24)}
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
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.locator(".markdown-surface")).toBeVisible();
}

async function assertInternalJump(
  page: Page,
  linkName: string,
  target: Locator,
) {
  const surface = page.locator(".markdown-surface");
  await surface.evaluate((node) => {
    node.scrollTop = 0;
  });
  const before = new URL(page.url());
  const pageCount = page.context().pages().length;

  await page.getByRole("link", { name: linkName, exact: true }).click();

  await expect
    .poll(() => surface.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(100);
  expect(page.context().pages()).toHaveLength(pageCount);
  const after = new URL(page.url());
  expect(after.origin).toBe(before.origin);
  expect(after.pathname).toBe(before.pathname);

  const geometry = await target.evaluate((targetNode) => {
    const surfaceNode = document.querySelector(
      ".markdown-surface",
    ) as HTMLElement;
    const targetElement = targetNode as HTMLElement;
    const targetStyle = getComputedStyle(targetElement);
    const heading = document.querySelector(
      "h3#generated-heading",
    ) as HTMLElement;
    return {
      targetDelta:
        targetElement.getBoundingClientRect().top -
        surfaceNode.getBoundingClientRect().top,
      surfaceBottom: surfaceNode.getBoundingClientRect().bottom,
      targetBottom: targetElement.getBoundingClientRect().bottom,
      targetMargin: Number.parseFloat(targetStyle.scrollMarginTop),
      headingMargin: Number.parseFloat(getComputedStyle(heading).scrollMarginTop),
    };
  });

  expect(Math.abs(geometry.targetMargin - geometry.headingMargin)).toBeLessThanOrEqual(4);
  expect(Math.abs(geometry.targetDelta - geometry.targetMargin)).toBeLessThanOrEqual(4);
  expect(geometry.targetBottom).toBeLessThanOrEqual(geometry.surfaceBottom);
}

test.describe("Markdown anchor navigation", () => {
  test.beforeEach(async ({ page }) => {
    await openFixture(page);
  });

  test("explicit fragment stays in Preview and uses heading scroll margin", async ({
    page,
  }) => {
    const target = page.locator('[id="user-content:explicit-target"]');
    await expect(target).toHaveCount(1);
    await expect(page.locator(".markdown-surface")).not.toContainText(
      '<a id="explicit-target">',
    );
    await assertInternalJump(page, "Explicit target", target);
  });

  test("generated heading fragment stays in Preview and uses shared scroll margin", async ({
    page,
  }) => {
    await assertInternalJump(
      page,
      "Generated heading",
      page.locator("h3#generated-heading"),
    );
  });
});

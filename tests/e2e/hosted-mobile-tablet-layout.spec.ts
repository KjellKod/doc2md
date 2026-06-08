import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const PHONE = { width: 375, height: 800 } as const;
const PHONE_KEYBOARD_OPEN = { width: 375, height: 340 } as const;
const TABLET_PORTRAIT = { width: 768, height: 1024 } as const;

const TAP_FLOOR_PX = 40;
const VIEWPORT_EDGE_TOLERANCE_PX = 2;

async function openHostedApp(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Upload" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));

  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.document).toBeLessThanOrEqual(1);
}

async function expectInViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
  expect(box!.y).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    viewport!.width + VIEWPORT_EDGE_TOLERANCE_PX,
  );
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    viewport!.height + VIEWPORT_EDGE_TOLERANCE_PX,
  );
}

async function expectHorizontallyInViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-VIEWPORT_EDGE_TOLERANCE_PX);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    viewport!.width + VIEWPORT_EDGE_TOLERANCE_PX,
  );
}

async function expectAlignedWidths(first: Locator, second: Locator) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(firstBox!.x - secondBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(firstBox!.width - secondBox!.width)).toBeLessThanOrEqual(2);
}

async function expectTapTargetFloor(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(TAP_FLOOR_PX);
  expect(box!.width).toBeGreaterThanOrEqual(TAP_FLOOR_PX);
}

async function uploadMarkdownFile(
  page: Page,
  name: string,
  body: string,
  options: { expandUploadPanel?: boolean } = {},
) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name, mimeType: "text/markdown", buffer: Buffer.from(body) },
  ]);
  // First upload auto-collapses the upload panel. Tests that need file-list
  // controls can opt back into the expanded state explicitly once the collapse
  // has completed.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (options.expandUploadPanel) {
    await expect(showUpload).toBeVisible({ timeout: 15_000 });
    await showUpload.click();
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Open ${name}` }),
    ).toHaveCount(1);
  }
}

async function expandCollapsedUploadPanel(page: Page) {
  // Opening the first file auto-collapses the upload panel, but on slower
  // engines (WebKit) that collapse can land *after* a one-shot visibility
  // sample — the panel then collapses right after we decline to expand it,
  // hiding the file row and flaking the row-visibility wait downstream.
  // Wait for the collapse to settle, then expand. Auto-collapse is one-shot,
  // so once expanded the panel stays expanded.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  await expect(showUpload).toBeVisible({ timeout: 15_000 });
  await showUpload.click();
  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
}

async function uploadInvalidPdf(page: Page, name: string) {
  // Bytes that look like garbage to the PDF converter and reliably drive
  // entry.status into "error" via the in-browser converter path.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from("not-a-real-pdf"),
    },
  ]);
}

test.describe("hosted mobile and tablet layout", () => {
  test("mobile emulation: collapsed upload rail stays horizontal with preview", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "device-emulation regression for mobile projects");

    await openHostedApp(page);
    await uploadMarkdownFile(
      page,
      "mobile-rail.md",
      "# Mobile rail\n\nThe collapsed upload control must not become a side strip.",
    );

    const workspace = page.locator(".workspace");
    const collapseRail = page.locator(".collapse-rail");
    const previewPanel = page.locator(".preview-panel");
    await expect(workspace).toHaveClass(/sidebar-collapsed/);
    await collapseRail.scrollIntoViewIfNeeded();

    await expectNoHorizontalOverflow(page);
    await expectHorizontallyInViewport(workspace, page);
    await expectHorizontallyInViewport(collapseRail, page);
    await expectHorizontallyInViewport(previewPanel, page);
    await expectAlignedWidths(collapseRail, previewPanel);

    const railBox = await collapseRail.boundingBox();
    expect(railBox).not.toBeNull();
    expect(railBox!.height).toBeLessThanOrEqual(92);
  });

  test("mobile emulation: keyboard-open editor remains focused and bounded", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "device-emulation regression for mobile projects");

    await openHostedApp(page);
    const startWriting = page.getByRole("button", {
      name: "Start writing",
      exact: true,
    });
    await startWriting.scrollIntoViewIfNeeded();
    await startWriting.click();

    const editor = page.getByLabel("Edit markdown");
    await editor.fill("# Mobile keyboard\n\nBefore keyboard.");
    await editor.focus();
    await page.setViewportSize(PHONE_KEYBOARD_OPEN);
    await page.evaluate(() => {
      document
        .querySelector(".preview-panel")
        ?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    });
    await editor.type("\nTyped while focused.");

    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue(/Typed while focused\./);
    await expectInViewport(editor, page);
    await expectInViewport(page.getByRole("button", { name: "Save document" }), page);
    await expectNoHorizontalOverflow(page);
  });

  test("AC1 at 375px: end-to-end draft, modes, save, primary action visible", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openHostedApp(page);

    // AC4 (landing): at least one primary action — the DropZone "browse from
    // your device" CTA — must be reachable in the initial viewport.
    const browseCta = page.getByRole("button", {
      name: "browse from your device",
      exact: true,
    });
    await expectInViewport(browseCta, page);

    // Start writing path (Preview panel Start writing button is below the
    // fold at 375x800 on first paint; scroll the page to find it, then start
    // the draft. The plan's flow at this point is "open a draft".
    const startWriting = page.getByRole("button", {
      name: "Start writing",
      exact: true,
    });
    await startWriting.scrollIntoViewIfNeeded();
    await startWriting.click();
    const editor = page.getByLabel("Edit markdown");
    await expect(editor).toBeFocused();
    await editor.fill(
      "# Phone draft\n\nLine one of the draft body.\n\nLine two of the draft body.",
    );

    const saveButton = page.getByRole("button", { name: "Save document" });
    await expect(saveButton).toBeVisible();

    // Mode switch via PreviewToolbar: edit -> preview -> linkedin -> edit.
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "View" })
        .getByRole("heading", { name: "Phone draft" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
    await expect(page.locator(".linkedin-surface")).toBeVisible();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Edit markdown")).toBeVisible();

    // Save is reachable and enabled for an edited draft.
    await expect(saveButton).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("AC1 at 375px and 768px: error recover from PreviewEmptyStates error", async ({
    page,
  }) => {
    for (const viewport of [PHONE, TABLET_PORTRAIT]) {
      await page.setViewportSize(viewport);
      await openHostedApp(page);
      await uploadInvalidPdf(page, "broken.pdf");
      await expandCollapsedUploadPanel(page);

      // Wait for the row's status indicator to settle into "error" so the
      // FileList row stops shifting before we interact with it.
      const errorRow = page.getByRole("button", { name: "Open broken.pdf" });
      await expect(errorRow).toBeVisible({ timeout: 15_000 });
      const errorStatus = errorRow.locator(".status-error");
      await expect(errorStatus).toBeVisible({ timeout: 15_000 });

      // Recovery via the FileList toolbar's Clear action — the failed entry
      // is auto-selected, so Clear active file removes it without needing
      // to re-click the row (which can be partially obscured at 375px).
      const clear = page.getByRole("button", { name: "Clear active file" });
      await expect(clear).toBeEnabled();
      await clear.click();

      await expect(page.getByRole("button", { name: "Open broken.pdf" })).toHaveCount(
        0,
      );
      await expectNoHorizontalOverflow(page);

      // After recovery, the landing primary action is reachable again.
      await expect(
        page.getByRole("button", {
          name: "browse from your device",
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  test("AC2 at 375px: tap-target floor on WorkingModeBar Save, PreviewToolbar mode switch, FileList row action", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openHostedApp(page);
    await uploadMarkdownFile(
      page,
      "tap-targets.md",
      "# Tap targets\n\nReady for measurement.",
      { expandUploadPanel: true },
    );

    const saveButton = page.getByRole("button", { name: "Save document" });
    await saveButton.scrollIntoViewIfNeeded();
    await expectTapTargetFloor(saveButton);

    const previewToggleEdit = page.getByRole("button", {
      name: "Edit",
      exact: true,
    });
    await previewToggleEdit.scrollIntoViewIfNeeded();
    await expectTapTargetFloor(previewToggleEdit);

    const fileRowOpen = page.getByRole("button", {
      name: "Open tap-targets.md",
    });
    await fileRowOpen.scrollIntoViewIfNeeded();
    await expectTapTargetFloor(fileRowOpen);
  });

  test("AC3 at 768px: workspace stacks; PreviewToolbar reachable; no overflow", async ({
    page,
  }) => {
    await page.setViewportSize(TABLET_PORTRAIT);
    await openHostedApp(page);
    await uploadMarkdownFile(
      page,
      "tablet.md",
      "# Tablet stack\n\nStacking should feel intentional.",
    );

    await expectNoHorizontalOverflow(page);

    // PreviewToolbar mode buttons reachable (scroll into view since the
    // workspace is stacked and the preview panel sits below the sidebar).
    const previewToolbar = page.locator(".preview-toolbar");
    await previewToolbar.scrollIntoViewIfNeeded();

    await expect(
      page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "LinkedIn", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save document" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find and replace" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("AC4 at 375px and 768px: landing CTA and working-mode Save are in initial viewport", async ({
    page,
  }) => {
    for (const viewport of [PHONE, TABLET_PORTRAIT]) {
      await page.setViewportSize(viewport);
      await openHostedApp(page);

      await expectInViewport(
        page.getByRole("button", {
          name: "browse from your device",
          exact: true,
        }),
        page,
      );

      const startWriting = page.getByRole("button", {
        name: "Start writing",
        exact: true,
      });
      await startWriting.scrollIntoViewIfNeeded();
      await startWriting.click();

      const saveButton = page.getByRole("button", { name: "Save document" });
      await expectInViewport(saveButton, page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("AC4 at 375px and 768px: loaded documents collapse upload chrome and keep preview real estate visible", async ({
    page,
  }) => {
    for (const viewport of [PHONE, TABLET_PORTRAIT]) {
      await page.setViewportSize(viewport);
      await openHostedApp(page);
      await uploadMarkdownFile(
        page,
        `loaded-${viewport.width}.md`,
        `# Loaded ${viewport.width}\n\nThe uploaded document should own the first view.`,
      );

      await expect(page.locator(".workspace")).toHaveClass(
        /sidebar-collapsed/,
      );
      await expect(
        page.getByRole("button", { name: "Show upload panel" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Hide upload panel" }),
      ).toHaveCount(0);

      const previewPanel = page.locator(".preview-panel");
      await expectHorizontallyInViewport(previewPanel, page);
      const previewBox = await previewPanel.boundingBox();
      const viewportSize = page.viewportSize();
      expect(previewBox).not.toBeNull();
      expect(viewportSize).not.toBeNull();
      expect(previewBox!.height).toBeGreaterThanOrEqual(
        Math.floor(viewportSize!.height * 0.55),
      );

      await page.getByRole("button", { name: "View", exact: true }).click();
      await expect(
        page
          .getByRole("region", { name: "View" })
          .getByRole("heading", { name: `Loaded ${viewport.width}` }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("AC8 at 375px: keyboard-open simulation keeps editor input and Save in viewport", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await openHostedApp(page);
    const startWriting = page.getByRole("button", {
      name: "Start writing",
      exact: true,
    });
    await startWriting.scrollIntoViewIfNeeded();
    await startWriting.click();
    const editor = page.getByLabel("Edit markdown");
    await editor.fill("# Keyboard occlusion\n\nLine below the heading.");
    await editor.focus();

    // Simulate the on-screen keyboard reducing the available viewport.
    await page.setViewportSize(PHONE_KEYBOARD_OPEN);

    // Real mobile browsers scroll the focused input into view when the
    // keyboard opens; Chromium with a manual setViewportSize does not.
    // Drive the preview-panel into view first so the sticky toolbar pins
    // Save at the top of the visible viewport (same end-state the user
    // sees on a real device).
    await page.evaluate(() => {
      document
        .querySelector(".preview-panel")
        ?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    });

    const saveButton = page.getByRole("button", { name: "Save document" });
    await expect(editor).toBeFocused();
    await editor.type("\nStill usable after keyboard resize.");
    await expect(editor).toHaveValue(/Still usable after keyboard resize\./);
    await expectInViewport(saveButton, page);
    await expectHorizontallyInViewport(editor, page);
    await expectNoHorizontalOverflow(page);
  });
});

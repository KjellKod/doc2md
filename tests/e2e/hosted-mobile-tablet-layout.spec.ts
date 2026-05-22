import { expect, test, type Locator, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const PHONE = { width: 375, height: 800 } as const;
const PHONE_KEYBOARD_OPEN = { width: 375, height: 340 } as const;
const TABLET_PORTRAIT = { width: 768, height: 1024 } as const;

const TAP_FLOOR_PX = 40;

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
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectTapTargetFloor(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(TAP_FLOOR_PX);
  expect(box!.width).toBeGreaterThanOrEqual(TAP_FLOOR_PX);
}

async function uploadMarkdownFile(page: Page, name: string, body: string) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name, mimeType: "text/markdown", buffer: Buffer.from(body) },
  ]);
  // First upload auto-collapses upload panel on desktop. At narrow widths
  // the collapse logic short-circuits, so this re-expand is a no-op then.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await expect(
    page.getByRole("button", { name: `Open ${name}` }),
  ).toBeVisible();
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
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Preview" })
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

      // Wait for the row's status indicator to settle into "error" so the
      // FileList row stops shifting before we interact with it.
      const errorRow = page.getByRole("button", { name: "Open broken.pdf" });
      await expect(errorRow).toBeVisible();
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
      page.getByRole("button", { name: "Preview", exact: true }),
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
    await expectInViewport(saveButton, page);
    await expectInViewport(editor, page);
    await expectNoHorizontalOverflow(page);
  });
});

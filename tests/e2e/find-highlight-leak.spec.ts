// Reproduction test for ideas/bug_report_find_highlight_dom_leaks.md
//
// Symptom A: searching in Preview makes the rendered text appear to
//   "edit itself" as the user navigates matches — characters shift,
//   <mark> artifacts appear, and the active match sometimes does not
//   light up.
//
// Symptom B: Edit-mode find leaves DOM fragments visible in Preview
//   after switching modes (Preview → Edit → Preview).
//
// Root cause per the bug doc: `applyRenderedFindHighlight` /
// `clearRenderedFindHighlight` mutate React-managed DOM via
// `range.extractContents()` and `range.insertNode()`. React then
// reconciles against the mutated tree, producing visible text shifts.
//
// This test exercises the documented user flow against unmodified
// production code. If the bug is live, the assertions on DOM-shape
// invariants will fail after match navigation.

import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

// Markdown that has multiple matches across emphasis spans. The plain
// word "alpha" appears 3 times: once inside `**bold**`, once inside
// `_italic_`, once as plain text. Navigating matches must NOT shift
// the visible characters and must NOT leave orphan <mark> nodes.
const FIXTURE_BODY = [
  "# Heading",
  "",
  "Plain alpha here.",
  "",
  "Bold **alpha** in this paragraph.",
  "",
  "Italic _alpha_ in this one.",
  "",
  "Closing paragraph.",
].join("\n");

const FIXTURE_NAME = "find-leak-fixture.md";

async function openFixtureInPreview(page: Page) {
  await page.goto("./");
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
  // Auto-collapse: re-expand for stability.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  // Wait for the preview heading to mount.
  await expect(
    page
      .getByRole("region", { name: "View" })
      .getByRole("heading", { name: "Heading" }),
  ).toBeVisible();
}

interface SurfaceShape {
  textContent: string;
  orphanMarkCount: number;
  emphasizedMarkCount: number; // <mark> inside <strong> or <em>
  strongCount: number;
  emCount: number;
  trimmedText: string;
}

async function awaitActiveMark(page: Page) {
  // The count text and the rehype plugin's <mark> can land in
  // different commits — wait for the mark itself before snapshotting.
  await expect(
    page.locator(".markdown-rendered-find-highlight").first(),
  ).toBeAttached();
}

async function captureSurfaceShape(page: Page): Promise<SurfaceShape> {
  return page.evaluate(() => {
    const surface = document.querySelector(
      ".markdown-surface",
    ) as HTMLElement | null;
    if (!surface) {
      return {
        textContent: "",
        orphanMarkCount: 0,
        emphasizedMarkCount: 0,
        strongCount: 0,
        emCount: 0,
        trimmedText: "",
      };
    }
    const marks = Array.from(
      surface.querySelectorAll("mark.markdown-rendered-find-highlight"),
    );
    let emphasizedMarkCount = 0;
    for (const m of marks) {
      const inEmphasis =
        m.closest("strong") !== null || m.closest("em") !== null;
      if (inEmphasis) emphasizedMarkCount += 1;
    }
    return {
      textContent: surface.textContent ?? "",
      orphanMarkCount: marks.length,
      emphasizedMarkCount,
      strongCount: surface.querySelectorAll("strong").length,
      emCount: surface.querySelectorAll("em").length,
      trimmedText: (surface.textContent ?? "").replace(/\s+/g, " ").trim(),
    };
  });
}

test("Symptom A: navigating matches in Preview does not shift visible text or duplicate marks", async ({
  page,
}) => {
  await openFixtureInPreview(page);

  // Capture the surface shape BEFORE find is open.
  const baseline = await captureSurfaceShape(page);
  expect(baseline.strongCount, "fixture must render <strong>").toBe(1);
  expect(baseline.emCount, "fixture must render <em>").toBe(1);

  // Open find from the toolbar (preview mode — match in rendered text).
  await page.getByRole("button", { name: "Find and replace" }).click();
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("alpha");
  // Match Case is on by default; lowercase "alpha" finds 3 occurrences.
  await expect(page.locator(".find-replace-count")).toHaveText(/of 3/);
  await awaitActiveMark(page);

  // Capture shape with the first match highlighted.
  const afterFirst = await captureSurfaceShape(page);
  // Visible characters must be unchanged from baseline.
  expect(
    afterFirst.trimmedText,
    "first-match render must not change visible text",
  ).toBe(baseline.trimmedText);
  // Structural invariants: exactly one rendered highlight, the original
  // <strong> and <em> are still present, no orphans.
  expect(
    afterFirst.orphanMarkCount,
    "first match: exactly one rendered <mark>",
  ).toBe(1);
  expect(afterFirst.strongCount).toBe(baseline.strongCount);
  expect(afterFirst.emCount).toBe(baseline.emCount);

  // Navigate to next match (REAL USER ACTION via the next-match button).
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/2 of 3/);
  await awaitActiveMark(page);
  const afterNext = await captureSurfaceShape(page);
  expect(
    afterNext.trimmedText,
    "second-match render must not change visible text",
  ).toBe(baseline.trimmedText);
  expect(
    afterNext.orphanMarkCount,
    "second match: exactly one rendered <mark>",
  ).toBe(1);
  expect(afterNext.strongCount).toBe(baseline.strongCount);
  expect(afterNext.emCount).toBe(baseline.emCount);

  // Third match — across the _em_ span.
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/3 of 3/);
  await awaitActiveMark(page);
  const afterThird = await captureSurfaceShape(page);
  expect(
    afterThird.trimmedText,
    "third-match render must not change visible text",
  ).toBe(baseline.trimmedText);
  expect(
    afterThird.orphanMarkCount,
    "third match: exactly one rendered <mark>",
  ).toBe(1);
  expect(afterThird.strongCount).toBe(baseline.strongCount);
  expect(afterThird.emCount).toBe(baseline.emCount);

  // Wrap around to match #1.
  await page.getByRole("button", { name: "Next match" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/1 of 3/);
  await awaitActiveMark(page);
  const afterWrap = await captureSurfaceShape(page);
  expect(afterWrap.trimmedText).toBe(baseline.trimmedText);
  expect(afterWrap.orphanMarkCount).toBe(1);
});

test("Symptom A (Enter-navigation variant): rendered text + structure invariant across many Enter-driven match cycles", async ({
  page,
}) => {
  // Use a denser fixture with more emphasis structures and more matches.
  const dense = [
    "# Dense",
    "",
    "Plain alpha here.",
    "",
    "Bold **alpha bravo** and `alpha-code` together.",
    "",
    "_Italic alpha_ with [alpha-link](https://example.com).",
    "",
    "More plain alpha at the end.",
    "",
    "alpha alpha alpha trailing.",
  ].join("\n");

  await page.goto("./");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: "dense.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(dense),
    },
  ]);
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  await expect(
    page
      .getByRole("region", { name: "View" })
      .getByRole("heading", { name: "Dense" }),
  ).toBeVisible();

  const baseline = await captureSurfaceShape(page);

  await page.getByRole("button", { name: "Find and replace" }).click();
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("alpha");
  await expect(page.locator(".find-replace-count")).toHaveText(/of \d/);

  // Press Enter many times in the find input — the bug doc explicitly
  // calls out Enter as a trigger. Each Enter advances to the next match
  // and re-runs the layout effect that mutates the rendered DOM.
  for (let i = 0; i < 12; i += 1) {
    await findInput.press("Enter");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const shape = await captureSurfaceShape(page);
    expect(
      shape.trimmedText,
      `iteration ${i}: visible text must not drift`,
    ).toBe(baseline.trimmedText);
    expect(
      shape.orphanMarkCount,
      `iteration ${i}: must have at most one rendered <mark>`,
    ).toBeLessThanOrEqual(1);
    expect(
      shape.strongCount,
      `iteration ${i}: <strong> count preserved`,
    ).toBe(baseline.strongCount);
    expect(
      shape.emCount,
      `iteration ${i}: <em> count preserved`,
    ).toBe(baseline.emCount);
  }
});

test("Symptom B: switching Preview → Edit → Preview with find active leaves the preview surface clean", async ({
  page,
}) => {
  await openFixtureInPreview(page);

  // Switch to Edit, open find, navigate matches, then come back.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("alpha");
  await page.getByRole("button", { name: "Next match" }).click();
  await page.getByRole("button", { name: "Next match" }).click();

  // Switch back to Preview.
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.locator(".markdown-surface")).toBeVisible();

  const shape = await captureSurfaceShape(page);
  // After mode-switch the preview surface should be in a clean state:
  // either no marks (find may have closed) or exactly one for the
  // active match. NO stale fragments, NO leaked <mark> elements from
  // the edit-mode find overlay.
  expect(shape.orphanMarkCount, "no orphan <mark> nodes after mode switch").toBeLessThanOrEqual(1);
  expect(shape.strongCount, "<strong> intact after mode switch").toBe(1);
  expect(shape.emCount, "<em> intact after mode switch").toBe(1);
});

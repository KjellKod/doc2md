// Reproduction test for ideas/bug_report_find_match_scrolls_to_wrong_line.md
//
// Symptom: in edit mode, navigating to a find match in a doc with long
// soft-wrapped paragraphs above the match causes scrollTop to land
// several visual rows off the match's actual position. The buggy helper
// `scrollTextareaToMatch` at src/components/PreviewPanel.tsx uses
// `estimatedLineHeight * (linesBeforeMatch - 1)` for the target — that
// math counts ONE row per source line and ignores soft-wrap, so for
// each wrapped paragraph above the match we drift by
// `(wrapped_rows_above - 1) * lineHeight`.
//
// The user-visible bar from the bug doc: "active-match navigation scrolls
// the textarea so the match is visible near the top of the visible content
// area (or centered, per the chosen offset), within one line of accuracy
// regardless of wrap."
//
// This test exercises the documented user flow against the unmodified
// production code. It MUST fail today; the fix is to delete
// `scrollTextareaToMatch` and route through `scrollTextareaToLine` (the
// measured-mirror helper used by view-anchor mode-switch) with a
// non-optional `offsetFraction` parameter to preserve centering.

import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

// 600 px is the same constraint the view-anchor spec uses. Within that
// height, default textarea font-size around 14px yields ~30 visible
// rows. The buggy helper estimates the match's visual row by source
// line count, so a paragraph that wraps to 6 visual rows is treated as
// 1 — that drift accumulates over multiple paragraphs above the match.
const SURFACE_CONSTRAINT = `
  .markdown-edit-shell,
  .markdown-find-overlay,
  .markdown-edit-area {
    max-height: 600px !important;
    width: 480px !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
    font-size: 14px !important;
    line-height: 20px !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }
`;

// Build a doc with 8 long paragraphs above the target match. Each
// paragraph is ~480 characters of running text that, at the 480px
// width set above, wraps to 5–7 visual rows. The MATCH_TOKEN appears
// only once, on its own short line, ~3 lines deep into the doc plus
// every long paragraph. With the buggy helper, scrollTop lands roughly
// (8 paragraphs × 5 extra-rows × 20px) ≈ 800px short of where the
// match actually renders.
const PARAGRAPH = Array.from(
  { length: 12 },
  (_, i) => `Lorem ipsum dolor sit amet consectetur adipiscing elit ${i + 1}.`,
).join(" ");
const PARAGRAPHS_ABOVE = 8;
const MATCH_TOKEN = "WHEREISTHEMATCH";

function buildFixtureBody(): string {
  const lines: string[] = [];
  for (let i = 0; i < PARAGRAPHS_ABOVE; i += 1) {
    lines.push(`Paragraph ${i + 1}: ${PARAGRAPH}`);
    lines.push("");
  }
  lines.push(`Target line: ${MATCH_TOKEN} appears here.`);
  // Add some trailing paragraphs so the textarea has scroll headroom.
  for (let i = 0; i < 4; i += 1) {
    lines.push("");
    lines.push(`Trailer paragraph ${i + 1}: ${PARAGRAPH}`);
  }
  return lines.join("\n");
}

const FIXTURE_NAME = "find-match-scroll-fixture.md";
const FIXTURE_BODY = buildFixtureBody();

async function openFixtureInEditMode(page: Page) {
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

  // Auto-collapse moves the file list behind the rail; re-expand so the
  // editor is fully visible.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }

  // Click Edit so the textarea mounts.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Edit markdown")).toBeVisible();
}

test("find-match navigation places the match inside the visible textarea viewport", async ({
  page,
}) => {
  await openFixtureInEditMode(page);

  // Open find and search for the unique token.
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+f" : "Control+f");
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill(MATCH_TOKEN);

  // Allow layout to settle after the find layout effect runs.
  await expect(page.locator(".find-replace-count")).toHaveText(/of 1/);

  // Wait two animation frames so React + browser scroll has flushed.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  // Measure: where is the match overlay <mark> rendered, and is it inside
  // the textarea's visible viewport? The find-overlay <pre> mirrors the
  // textarea geometry, so the <mark> rect is the visible position of the
  // active match.
  const result = await page.evaluate(() => {
    const overlay = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLElement | null;
    const mark = document.querySelector(
      ".markdown-find-overlay mark",
    ) as HTMLElement | null;
    const textarea = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement | null;
    if (!overlay || !mark || !textarea) {
      return null;
    }
    const overlayRect = overlay.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const lineHeight = Number.parseFloat(
      getComputedStyle(textarea).lineHeight,
    ) || 20;
    // How far is the match top inside the overlay's visible viewport?
    const markTopInOverlay = markRect.top - overlayRect.top;
    return {
      overlayHeight: overlay.clientHeight,
      markTopInOverlay,
      markBottomInOverlay: markRect.bottom - overlayRect.top,
      lineHeight,
      textareaScrollTop: textarea.scrollTop,
      textareaScrollHeight: textarea.scrollHeight,
      textareaClientHeight: textarea.clientHeight,
    };
  });
  expect(result, "overlay / mark / textarea must be present").not.toBeNull();
  if (!result) return;

  // Acceptance criterion from the bug doc: match is visible in the
  // textarea's content area within one line of accuracy. Allow a one-
  // lineHeight slack on each side (the original spec said "near the top
  // of the visible content area OR centered"; either is acceptable as
  // long as the match is INSIDE the viewport).
  const slack = result.lineHeight;
  expect(
    result.markTopInOverlay,
    `match top (${result.markTopInOverlay}px) should be >= -slack (${-slack}px); overlayHeight=${result.overlayHeight}, scrollTop=${result.textareaScrollTop}, scrollHeight=${result.textareaScrollHeight}`,
  ).toBeGreaterThanOrEqual(-slack);
  expect(
    result.markBottomInOverlay,
    `match bottom (${result.markBottomInOverlay}px) should be <= overlayHeight + slack (${result.overlayHeight + slack}px); scrollTop=${result.textareaScrollTop}, scrollHeight=${result.textareaScrollHeight}`,
  ).toBeLessThanOrEqual(result.overlayHeight + slack);
});

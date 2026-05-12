// Integration-level Playwright specs that reproduce realistic editor usage
// — multi-keystroke sequences, existing-document editing, timing — so we
// catch the kinds of regressions that single-keystroke unit tests miss.

import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

async function openExistingMarkdown(page: Page, name: string, body: string) {
  await page.goto("./");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name, mimeType: "text/markdown", buffer: Buffer.from(body) },
  ]);
  // Sidebar auto-collapses on first file open; re-expand to access the
  // file list / preview heading reliably.
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
  // Wait for the preview to mount.
  await expect(
    page
      .getByRole("region", { name: "Preview" })
      .getByRole("heading")
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Edit markdown")).toBeVisible();
}

async function selectRange(page: Page, start: number, end: number) {
  await page.evaluate(
    ({ start, end }) => {
      const ta = document.querySelector(
        "textarea.markdown-edit-area",
      ) as HTMLTextAreaElement;
      ta.focus();
      ta.setSelectionRange(start, end);
    },
    { start, end },
  );
}

// BUG 1 / BUG 3 / BUG 4 / feedback a — repro: after auto-continue, the
// editor should remain responsive and the cursor must land where the user
// next types/clicks, NOT jump back to the post-Enter caret position.
test("editor remains responsive after auto-continue and respects subsequent input", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");

  const start = Date.now();
  await editor.fill("- test");
  await editor.press("Enter");
  await expect(editor).toHaveValue("- test\n- ");
  const enterDuration = Date.now() - start;
  // 5-second freeze was bug 1's signature. Allow generous headroom but
  // catch a true hang. CI variance is fine under ~2s.
  expect(enterDuration).toBeLessThan(2500);

  // Type more characters into the continued bullet — they must land at the
  // current cursor (end of `- `) without the cursor jumping.
  await page.keyboard.type("alpha");
  await expect(editor).toHaveValue("- test\n- alpha");

  // Click into the first line, between `t` and `e` of `test`. The cursor
  // must stay where we click; no setTimeout race may snap it elsewhere.
  await page.evaluate(() => {
    const ta = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(3, 3); // after "- t"
  });
  await page.keyboard.type("Z");
  await expect(editor).toHaveValue("- tZest\n- alpha");
});

// BUG 2 — auto-continue from an EXISTING document (not a fresh scratch).
test("auto-continue works on a list inside a freshly-opened document", async ({
  page,
}) => {
  await openExistingMarkdown(page, "list-doc.md", "- test 1\n- test 2");
  const editor = page.getByLabel("Edit markdown") as ReturnType<Page["getByLabel"]>;

  // Place the cursor at the end of `- test 2` (the doc's last byte).
  await page.evaluate(() => {
    const ta = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });

  await editor.press("Enter");
  await expect(editor).toHaveValue("- test 1\n- test 2\n- ");

  // Now type — the cursor must be at the end of the new bullet.
  await page.keyboard.type("test 3");
  await expect(editor).toHaveValue("- test 1\n- test 2\n- test 3");
});

// feedback a — Cmd-B / Cmd-I / Cmd-K should be near-instant. Slow path was
// the old full-document `execCommand('insertText')` replacement; targeted
// inserts should commit in tens of ms.
test("Cmd-B on selected text commits fast (no full-document replace)", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  // Bigger body to make a slow path obvious.
  const body = "hello world\n" + "lorem ipsum dolor sit amet\n".repeat(200);
  await editor.fill(body);
  await selectRange(page, 6, 11); // selects "world"

  const isMac = process.platform === "darwin";
  const start = Date.now();
  await page.keyboard.press(isMac ? "Meta+b" : "Control+b");
  await expect(editor).toHaveValue(body.replace("world", "**world**"));
  const elapsed = Date.now() - start;
  // Generous headroom for CI; the regression was multi-second.
  expect(elapsed).toBeLessThan(1000);
});

// BUG 5 — Cmd-F should show Replace controls by default in edit mode AND
// place focus on the Find input (NOT the Replace input — that wasted a click).
test("Cmd-F in edit mode opens Find AND Replace, focus lands on Find", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("hello hello");

  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+f" : "Control+f");

  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  const replaceInput = page.getByRole("textbox", { name: "Replacement text" });
  await expect(findInput).toBeVisible();
  // Replacement input is visible WITHOUT clicking "Show replace controls".
  await expect(replaceInput).toBeVisible();
  // And the toggle reads "Hide" because Replace is already shown.
  await expect(
    page.getByRole("button", { name: "Hide replace controls" }),
  ).toBeVisible();
  // CRITICAL: Cmd-F lands focus on Find, not Replace. Typing the query
  // immediately is the user's expected next action.
  await expect(findInput).toBeFocused();
});

// Match Case ships ON by default: a developer searching their own markdown
// usually means the exact casing they typed. The toggle is still available.
test("Match Case is enabled by default on Cmd-F", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  // "Apple" (capital) appears once; "apple" (lowercase) appears twice. A
  // case-insensitive default would surface 3; case-sensitive default
  // surfaces only 2 for "apple".
  await editor.fill("Apple apple apple");

  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+f" : "Control+f");

  await page.getByRole("textbox", { name: "Find markdown text" }).fill("apple");
  await expect(page.locator(".find-replace-count")).toHaveText(/of 2\b/);

  // Toggle is aria-pressed = true on open.
  await expect(
    page.getByRole("button", { name: "Case-sensitive search" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Turning it off should bring all 3 occurrences.
  await page.getByRole("button", { name: "Case-sensitive search" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/of 3\b/);
});

// Cmd-Alt-F should still place focus on Replace (that's the intent of
// the replace-shortcut).
test("Cmd-Alt-F in edit mode focuses the Replace input", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("hello hello");

  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+Alt+f" : "Control+Alt+f");

  await expect(
    page.getByRole("textbox", { name: "Replacement text" }),
  ).toBeFocused();
});

// BUG 6 — Find input must not autocorrect / capitalize on the user.
test("Find input does not autocorrect / autocapitalize", async ({ page }) => {
  await openScratchEditor(page);
  await page.getByRole("button", { name: "Find and replace" }).click();
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.click();
  // Match attributes that disable browser-side text correction. The
  // browser autocorrect prompt is OS-specific; asserting the attributes
  // catches the regression deterministically.
  await expect(findInput).toHaveAttribute("autocorrect", "off");
  await expect(findInput).toHaveAttribute("autocapitalize", "off");
  await expect(findInput).toHaveAttribute("spellcheck", "false");
});

// BUG 9 — Replace All in a moderate document should be near-instant.
test("Replace All on a moderate document is fast", async ({ page }) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  // ~20 occurrences of the target word across a moderate doc.
  const body =
    "lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(80) +
    Array.from({ length: 20 }, (_, i) => `paragraph ${i + 1} mentions apple here.`).join(
      "\n",
    );
  await editor.fill(body);
  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("apple");
  await page.getByRole("textbox", { name: "Replacement text" }).fill("pear");

  const start = Date.now();
  await page
    .locator(".find-replace-replace-actions")
    .getByRole("button", { name: "Replace All", exact: true })
    .click();
  await expect(editor).toHaveValue(body.replace(/apple/g, "pear"));
  const elapsed = Date.now() - start;
  // The reported regression was "many seconds"; cap at 2.5s to catch it.
  expect(elapsed).toBeLessThan(2500);
});

// Replace All must be Cmd-Z reversible — even if undo unwinds one match
// per press rather than all at once. Earlier regression: controlled-write
// path bypassed the textarea's native undo stack entirely, so Cmd-Z was
// a no-op after Replace All.
test("Cmd-Z after Replace All restores matches one at a time", async ({
  page,
}) => {
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  await editor.fill("apple banana apple cherry apple");

  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("apple");
  await page.getByRole("textbox", { name: "Replacement text" }).fill("pear");

  await page
    .locator(".find-replace-replace-actions")
    .getByRole("button", { name: "Replace All", exact: true })
    .click();
  await expect(editor).toHaveValue("pear banana pear cherry pear");

  // Cmd-Z (without refocusing) reverts ONE match at a time. After three
  // undos the content is fully restored.
  const isMac = process.platform === "darwin";
  const undoKey = isMac ? "Meta+z" : "Control+z";
  await page.keyboard.press(undoKey);
  await page.keyboard.press(undoKey);
  await page.keyboard.press(undoKey);
  await expect(editor).toHaveValue("apple banana apple cherry apple");
});

// BUG 9 revisit — user reported 30s for 250 replacements in a 16K-word
// document. The bottleneck was the single-undo full-document execCommand
// insertText. Replace All now uses a controlled write only; the trade-off
// is loss of single-undo as a hard guarantee. This test enforces the
// performance contract on a doc comparable to what the user hit.
test("Replace All scales to 16K-word documents with 250 replacements", async ({
  page,
}) => {
  // Wider timeout because the fill itself takes time on a large body.
  test.setTimeout(60_000);
  await openScratchEditor(page);
  const editor = page.getByLabel("Edit markdown");
  // ~16K words. Each paragraph has roughly 32 words.
  // 250 occurrences of "lorem" scattered through.
  const paragraph =
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do " +
    "eiusmod tempor incididunt ut labore et dolore magna aliqua ut " +
    "enim ad minim veniam quis nostrud exercitation ullamco";
  // ~32 words × ~500 paragraphs = 16K words. "lorem" appears once per
  // paragraph → 500 occurrences. We'll cap to first 250 by limiting query
  // to a unique anchor instead.
  const body = Array.from(
    { length: 500 },
    (_, i) => `${paragraph} marker${i % 250 === 0 ? "X" : ""} ${i}.`,
  ).join("\n\n");
  // Build via JS for speed — `editor.fill` for a huge string is slow itself.
  await page.evaluate((value) => {
    const ta = document.querySelector(
      "textarea.markdown-edit-area",
    ) as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(ta, value);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, body);
  await expect(editor).toHaveValue(body);

  await page.getByRole("button", { name: "Find and replace" }).click();
  await page
    .getByRole("textbox", { name: "Find markdown text" })
    .fill("lorem");
  await page.getByRole("textbox", { name: "Replacement text" }).fill("PINE");

  const start = Date.now();
  await page
    .locator(".find-replace-replace-actions")
    .getByRole("button", { name: "Replace All", exact: true })
    .click();
  // After Replace All, the find re-runs on the new content. 0 "lorem"
  // remain. The replace status pill confirms completion.
  await expect(page.locator(".find-replace-count")).toHaveText(/^Replaced \d+/);
  const elapsed = Date.now() - start;
  // The user reported 30s for this size. Lock in a hard cap well below
  // that. 5s gives CI variance headroom.
  expect(elapsed).toBeLessThan(5000);
  // Sanity: every "lorem" was replaced with "PINE".
  await expect(editor).not.toHaveValue(/lorem/i);
});

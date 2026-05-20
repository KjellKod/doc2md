import { expect, test, type Page } from "@playwright/test";

// Regression guard for "pasting a large markdown blob into a scratch entry
// shrinks the hero into working-mode chrome." This used to be true in both
// the hosted web build and the Mac shell, but a refactor (PR #135) silently
// dropped the desktop side. The matching desktop test lives at
// src/__tests__/App.desktop.test.tsx — keep both in step so the regression
// class is caught on either shell.

async function openScratchEditor(page: Page) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  await expect(page.getByLabel("Edit markdown")).toBeFocused();
}

async function pastePlainText(page: Page, plainText: string) {
  await page.getByLabel("Edit markdown").evaluate((node, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, plainText);
}

test("large paste into a scratch draft promotes the page into working mode", async ({
  page,
}) => {
  await openScratchEditor(page);

  // Pre-condition: the hero is still showing because the entry is a fresh
  // scratch draft with no contents.
  await expect(page.locator(".page")).not.toHaveClass(/is-working-mode/);
  await expect(
    page.getByRole("heading", {
      name: "Edit or convert to Markdown, without leaving the browser.",
    }),
  ).toBeVisible();

  // Paste a >200 character blob to trip the large-paste threshold.
  await pastePlainText(page, "x".repeat(201));

  // Page should now be in working mode: the hero collapses and the working
  // mode bar exposes the "return to landing" toggle.
  await expect(page.locator(".page")).toHaveClass(/is-working-mode/);
  await expect(
    page.getByRole("button", { name: "Show intro and return to landing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Edit or convert to Markdown, without leaving the browser.",
    }),
  ).not.toBeVisible();
});

test("small paste into a scratch draft does not promote it into working mode", async ({
  page,
}) => {
  // Below the 200-character threshold, the hero must stay put so day-to-day
  // edits do not slam the chrome away.
  await openScratchEditor(page);
  await pastePlainText(page, "short note");

  await expect(page.locator(".page")).not.toHaveClass(/is-working-mode/);
  await expect(
    page.getByRole("heading", {
      name: "Edit or convert to Markdown, without leaving the browser.",
    }),
  ).toBeVisible();
});

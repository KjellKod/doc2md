import { expect, test, type Page } from "@playwright/test";
import { openFindBar } from "./helpers/findBar";

async function openEditorWith(page: Page, content: string) {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Start writing", exact: true })
    .click();
  const editor = page.getByLabel("Edit markdown");
  await expect(editor).toBeFocused();
  await editor.fill(content);
}

test("Whole Word reduces the match count to whole-word occurrences only", async ({
  page,
}) => {
  await openEditorWith(page, "foo foobar foo_bar foo2 foo");

  // Open find from the toolbar.
  await openFindBar(page);
  const findInput = page.getByRole("textbox", { name: "Find markdown text" });
  await findInput.fill("foo");

  // Without whole word, all five "foo" substrings match.
  await expect(page.locator(".find-replace-count")).toHaveText(/of 5\b/);

  // Enable Whole Word.
  await page.getByRole("button", { name: "Match whole word" }).click();

  // Only the two stand-alone "foo" tokens remain.
  await expect(page.locator(".find-replace-count")).toHaveText(/of 2\b/);

  // Toggle off and the count returns.
  await page.getByRole("button", { name: "Match whole word" }).click();
  await expect(page.locator(".find-replace-count")).toHaveText(/of 5\b/);
});

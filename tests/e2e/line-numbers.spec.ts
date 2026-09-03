import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

function contrastRatio(foreground: string, background: string) {
  const channels = (color: string) =>
    (color.match(/[\d.]+/gu) ?? [])
      .slice(0, 3)
      .map((value) => Number(value) / 255)
      .map((value) =>
        value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4,
      );
  const luminance = (color: string) => {
    const [red = 0, green = 0, blue = 0] = channels(color);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function openMarkdown(page: Page, name: string, markdown: string) {
  await page.goto("./");
  await page.addStyleTag({
    content: `
      .markdown-surface,
      .markdown-edit-shell,
      .markdown-find-overlay,
      .markdown-edit-area { max-height: 600px !important; }
    `,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles([
    {
      name,
      mimeType: "text/markdown",
      buffer: Buffer.from(markdown),
    },
  ]);
  await expect(page.locator(".markdown-surface")).toBeVisible();
}

async function openMarkdownFiles(
  page: Page,
  files: Array<{ name: string; markdown: string }>,
) {
  await page.goto("./");
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "browse from your device", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles(
    files.map(({ name, markdown }) => ({
      name,
      mimeType: name.endsWith(".json") ? "application/json" : "text/markdown",
      buffer: Buffer.from(markdown),
    })),
  );
  const showUpload = page.getByRole("button", { name: "Show upload panel" });
  if (await showUpload.isVisible().catch(() => false)) {
    await showUpload.click();
  }
}

async function showLineNumbers(page: Page) {
  const desktopControl = page.getByRole("checkbox", {
    name: "Line numbers",
  });
  if (await desktopControl.isVisible().catch(() => false)) {
    await desktopControl.click();
    return;
  }

  await page.getByRole("button", { name: "More actions" }).click();
  const menuItem = page.getByRole("menuitemcheckbox", {
    name: "Line numbers",
  });
  await expect(menuItem).toHaveAttribute("aria-checked", "false");
  await menuItem.click();
}

interface PaintedBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

async function paintedBeforeBoxes(
  page: Page,
  selectors: Record<string, string>,
): Promise<Record<string, PaintedBox>> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    const { root } = await session.send("DOM.getDocument", {
      depth: -1,
      pierce: true,
    });
    const boxes: Record<string, PaintedBox> = {};

    for (const [name, selector] of Object.entries(selectors)) {
      const { nodeId } = await session.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector,
      });
      if (nodeId === 0) {
        throw new Error(`Could not find marker host: ${selector}`);
      }
      const { node } = await session.send("DOM.describeNode", {
        nodeId,
        depth: 1,
        pierce: true,
      });
      const before = node.pseudoElements?.find(
        (pseudo) => pseudo.pseudoType === "before",
      );
      if (!before) {
        throw new Error(`Could not find painted ::before marker: ${selector}`);
      }
      const { model } = await session.send("DOM.getBoxModel", {
        nodeId: before.nodeId,
      });
      const [x1, y1, x2, y2, x3, y3, x4, y4] = model.border;
      boxes[name] = {
        left: Math.min(x1, x2, x3, x4),
        right: Math.max(x1, x2, x3, x4),
        top: Math.min(y1, y2, y3, y4),
        bottom: Math.max(y1, y2, y3, y4),
      };
    }

    return boxes;
  } finally {
    await session.detach();
  }
}

async function topSourceLineFromEditor(page: Page): Promise<number> {
  return page.evaluate(() => {
    const textarea = document.querySelector(
      'textarea[aria-label="Edit markdown"]',
    ) as HTMLTextAreaElement;
    const mirror = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLElement;
    mirror.scrollTop = textarea.scrollTop;
    const top = mirror.getBoundingClientRect().top;
    const source = textarea.value;
    const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let current = walker.nextNode() as Text | null;
    while (current) {
      for (let index = 0; index < current.data.length; index += 1) {
        const range = document.createRange();
        range.setStart(current, index);
        range.setEnd(current, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.top >= top - 4 && rect.height > 0) {
          return source.slice(0, offset + index).split("\n").length;
        }
      }
      offset += current.data.length;
      current = walker.nextNode() as Text | null;
    }
    return 1;
  });
}

test("View renders original source markers without changing the accessibility tree", async ({
  page,
}, testInfo) => {
  await openMarkdown(
    page,
    "mapped.md",
    [
      "# Heading",
      "",
      "Paragraph",
      "",
      "> Quote",
      "> ## Nested quote heading",
      "",
      "- [ ] Parent task",
      "  - [ ] Child task",
      "    - [ ] Grandchild task",
      "      - [ ] Great-grandchild task",
      "",
      "```ts",
      "const value = true;",
      "```",
      "",
      "| Name | Score |",
      "| --- | --- |",
      "| Ada | 10 |",
    ].join("\n"),
  );
  const surface = page.locator(".markdown-surface");
  const before = await surface.ariaSnapshot();

  await showLineNumbers(page);

  await expect(surface.locator("h1")).toHaveAttribute(
    "data-source-line-number",
    "1",
  );
  await expect(surface.locator("blockquote")).toHaveAttribute(
    "data-source-line-number",
    "5",
  );
  await expect(surface.locator("pre")).toHaveAttribute(
    "data-source-line-number",
    "13",
  );
  const listItems = surface.locator("li[data-source-line-number]");
  await expect(listItems).toHaveCount(4);
  const markerGeometry = await page.evaluate(() => {
    const surface = document.querySelector(".markdown-surface") as HTMLElement;
    const stamped = Array.from(
      surface.querySelectorAll<HTMLElement>("[data-source-line-number]"),
    );
    const pre = surface.querySelector("pre[data-source-line-number]") as HTMLElement;
    const firstTableCell = surface.querySelector(
      "th[data-source-line-number]",
    ) as HTMLElement;
    return {
      stampedPositions: stamped.map((element) => getComputedStyle(element).position),
      surfacePosition: getComputedStyle(surface).position,
      preMarkerContent: getComputedStyle(pre, "::before").content,
      tableMarkerContent: getComputedStyle(firstTableCell, "::before").content,
      preOverflow: getComputedStyle(surface.querySelector("pre") as HTMLElement)
        .overflow,
      codeOverflow: getComputedStyle(surface.querySelector("pre code") as HTMLElement)
        .overflowX,
      tableOverflow: getComputedStyle(
        surface.querySelector("table") as HTMLElement,
      ).overflow,
    };
  });
  expect(markerGeometry.surfacePosition).toBe("relative");
  expect(markerGeometry.stampedPositions.every((position) => position === "static")).toBe(
    true,
  );
  expect(markerGeometry.preOverflow).toBe("visible");
  expect(markerGeometry.codeOverflow).toBe("auto");
  expect(markerGeometry.tableOverflow).toBe("visible");
  expect(markerGeometry.preMarkerContent).toContain("13");
  expect(markerGeometry.tableMarkerContent).toContain("17");
  if (testInfo.project.name === "chromium") {
    const boxes = await paintedBeforeBoxes(page, {
      heading: ".markdown-surface h1[data-source-line-number]",
      quoteHeading:
        ".markdown-surface blockquote h2[data-source-line-number]",
      nestedList:
        ".markdown-surface li li li li[data-source-line-number]",
      code: ".markdown-surface pre[data-source-line-number]",
      table: ".markdown-surface th[data-source-line-number]",
    });
    const lefts = Object.values(boxes).map((box) => box.left);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
    const checkbox = await surface
      .getByRole("checkbox", { name: "Toggle task: Great-grandchild task" })
      .boundingBox();
    expect(boxes.nestedList.right).toBeLessThanOrEqual(checkbox?.x ?? 0);
  }
  const generatedContent = await surface.locator("h1").evaluate((element) =>
    getComputedStyle(element, "::before").content,
  );
  expect(generatedContent).toContain("1");
  const darkColors = await surface.locator("h1").evaluate((element) => ({
    marker: getComputedStyle(element, "::before").color,
  }));
  const darkMarkerColor = darkColors.marker;
  expect(darkMarkerColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(contrastRatio(darkColors.marker, "rgb(17, 21, 27)")).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "Day mode" }).click();
  const lightColors = await surface.locator("h1").evaluate((element) => ({
    marker: getComputedStyle(element, "::before").color,
  }));
  const lightMarkerColor = lightColors.marker;
  expect(lightMarkerColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(lightMarkerColor).not.toBe(darkMarkerColor);
  expect(contrastRatio(lightColors.marker, "rgb(251, 248, 242)")).toBeGreaterThanOrEqual(4.5);
  expect(await surface.ariaSnapshot()).toBe(before);
});

test("desktop checkbox toggles in both themes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Desktop checkbox semantics run once in desktop Chromium.",
  );
  await openMarkdown(page, "toggle.md", "# Toggle");
  const control = page.getByRole("checkbox", { name: "Line numbers" });
  await expect(control).toBeVisible();
  await expect(control).not.toBeChecked();
  await control.click();
  await expect(control).toBeChecked();

  await page.getByRole("button", { name: "Day mode" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.theme ?? "light"),
    )
    .toBe("light");
  await expect(control).toBeVisible();
  await expect(control).toBeChecked();
  await control.click();
  await expect(control).not.toBeChecked();
});

test("5000-line Edit gutter aligns, scrolls, and preserves native input", async ({
  page,
}) => {
  const markdown = Array.from(
    { length: 5_001 },
    (_, index) => (index % 17 === 16 ? "" : `line ${index + 1} ${"wrap ".repeat(12)}`),
  ).join("\n");
  await openMarkdown(page, "long.md", markdown);
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  const textarea = page.getByRole("textbox", { name: "Edit markdown" });
  await textarea.evaluate((element) => {
    const editor = element as HTMLTextAreaElement;
    editor.scrollTop = 2_400;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await showLineNumbers(page);
  const gutter = page.locator(".markdown-line-number-gutter");
  await expect(gutter.locator(".markdown-line-number-row")).toHaveCount(5_001);

  const metrics = await page.evaluate(() => {
    const textarea = document.querySelector(
      ".markdown-edit-area",
    ) as HTMLTextAreaElement;
    const overlay = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLElement;
    const gutter = document.querySelector(
      ".markdown-line-number-gutter",
    ) as HTMLElement;
    const firstMetricText = gutter.querySelector(
      ".markdown-line-number-metric",
    )?.firstChild as Text;
    const overlayText = overlay.firstChild as Text;
    const textareaStyle = getComputedStyle(textarea);
    const metricRange = document.createRange();
    metricRange.setStart(firstMetricText, 0);
    metricRange.setEnd(firstMetricText, 1);
    const overlayRange = document.createRange();
    overlayRange.setStart(overlayText, 0);
    overlayRange.setEnd(overlayText, 1);
    const alignmentDelta = Math.abs(
      metricRange.getBoundingClientRect().top -
        overlayRange.getBoundingClientRect().top,
    );
    return {
      alignmentDelta,
      gutterScrollTop: gutter.scrollTop,
      textareaScrollTop: textarea.scrollTop,
      textareaPadding: textareaStyle.paddingInlineStart,
      overlayPadding: getComputedStyle(overlay).paddingInlineStart,
      digits: getComputedStyle(
        document.querySelector(".markdown-edit-shell") as HTMLElement,
      ).getPropertyValue("--line-number-digits"),
      markerColor: getComputedStyle(gutter).color,
    };
  });

  expect(metrics.alignmentDelta).toBeLessThanOrEqual(1);
  expect(metrics.gutterScrollTop).toBe(metrics.textareaScrollTop);
  expect(metrics.textareaPadding).toBe(metrics.overlayPadding);
  expect(metrics.digits.trim()).toBe("4");
  expect(contrastRatio(metrics.markerColor, "rgb(18, 23, 29)")).toBeGreaterThanOrEqual(4.5);

  await textarea.evaluate((element) => {
    const editor = element as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  });
  await textarea.pressSequentially("\ntyped at end");
  await expect(textarea).toHaveValue(`${markdown}\ntyped at end`);
});

test("Edit gutter keeps deep numerals on the textarea line pitch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-safari",
    "WebKit regression matches the macOS app rendering engine.",
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  const markdown = Array.from({ length: 220 }, (_, index) => {
    if (index === 166 || index === 168) return "";
    if (index === 167) return "---";
    if (index === 169) return "# Apple Purchases";
    if (index % 11 === 0) return `wrapped ${"content ".repeat(30)}`;
    return `line ${index + 1}`;
  }).join("\n");
  await openMarkdown(page, "deep-lines.md", markdown);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await showLineNumbers(page);

  const geometry = await page.evaluate(() => {
    const textarea = document.querySelector(
      ".markdown-edit-area",
    ) as HTMLTextAreaElement;
    const gutter = document.querySelector(
      ".markdown-line-number-gutter",
    ) as HTMLElement;
    const numberTexts = gutter.querySelectorAll(
      ".markdown-line-number-value",
    );
    const metricTexts = gutter.querySelectorAll(
      ".markdown-line-number-metric",
    );
    const textTop = (texts: NodeListOf<Element>, lineIndex: number) => {
      const text = texts[lineIndex]?.firstChild as Text;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, text.length);
      return range.getBoundingClientRect().top;
    };
    const deepIndex = 169;
    return {
      integralLinePitchDelta: Math.abs(
        parseFloat(getComputedStyle(textarea).lineHeight) -
          Math.round(parseFloat(getComputedStyle(textarea).lineHeight)),
      ),
      visibleNumberDelta: Math.abs(
        textTop(numberTexts, deepIndex) - textTop(metricTexts, deepIndex),
      ),
      scrollHeightDelta: Math.abs(gutter.scrollHeight - textarea.scrollHeight),
    };
  });

  expect(geometry.integralLinePitchDelta).toBeLessThanOrEqual(0.001);
  expect(geometry.scrollHeightDelta).toBeLessThanOrEqual(1);
  expect(geometry.visibleNumberDelta).toBeLessThanOrEqual(1);
});

test("Edit gutter stays aligned across 99 to 100 lines, scrolling, and resize", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Canonical subpixel geometry runs once in desktop Chromium.",
  );
  const markdown = Array.from({ length: 99 }, (_, index) => {
    if (index === 69) return "";
    if (index === 70) return `wrapped ${"content ".repeat(30)}`;
    return `line ${index + 1}`;
  }).join("\n");
  await openMarkdown(page, "digits.md", markdown);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await showLineNumbers(page);

  const textarea = page.getByRole("textbox", { name: "Edit markdown" });
  const shell = page.locator(".markdown-edit-shell");
  await expect(shell).toHaveCSS("--line-number-digits", "2");
  await textarea.evaluate((element) => {
    const editor = element as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  });
  await textarea.pressSequentially("\nline 100");
  await expect(shell).toHaveCSS("--line-number-digits", "3");

  await page.setViewportSize({ width: 700, height: 760 });
  const deltas = await page.evaluate(() => {
    const textarea = document.querySelector(
      ".markdown-edit-area",
    ) as HTMLTextAreaElement;
    const overlay = document.querySelector(
      ".markdown-find-overlay",
    ) as HTMLElement;
    const gutter = document.querySelector(
      ".markdown-line-number-gutter",
    ) as HTMLElement;
    textarea.scrollTop = 1_200;
    textarea.dispatchEvent(new Event("scroll", { bubbles: true }));
    const overlayText = overlay.firstChild as Text;
    const lines = textarea.value.split("\n");
    const lineStart = (lineNumber: number) =>
      lines
        .slice(0, lineNumber - 1)
        .reduce((total, line) => total + line.length + 1, 0);
    const rangeTop = (text: Text, start: number, end: number) => {
      const range = document.createRange();
      range.setStart(text, start);
      range.setEnd(text, end);
      return range.getBoundingClientRect().top;
    };
    const metricTop = (lineNumber: number) => {
      const rowText = gutter.querySelectorAll(
        ".markdown-line-number-metric",
      )[lineNumber - 1]?.firstChild as Text;
      return rangeTop(rowText, 0, 1);
    };
    const overlayTop = (lineNumber: number) => {
      const start = lineStart(lineNumber);
      return rangeTop(overlayText, start, Math.min(start + 1, overlayText.length));
    };
    const lineHeight = parseFloat(getComputedStyle(overlay).lineHeight);
    return {
      blank: Math.abs(metricTop(70) - (overlayTop(71) - lineHeight)),
      wrapped: Math.abs(metricTop(71) - overlayTop(71)),
      final: Math.abs(metricTop(100) - overlayTop(100)),
      gutterScrollTop: gutter.scrollTop,
      textareaScrollTop: textarea.scrollTop,
    };
  });

  expect(deltas.blank).toBeLessThanOrEqual(1);
  expect(deltas.wrapped).toBeLessThanOrEqual(1);
  expect(deltas.final).toBeLessThanOrEqual(1);
  expect(deltas.gutterScrollTop).toBe(deltas.textareaScrollTop);
});

test("large fenced JSON exposes no line-number control or markers", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Large-content suppression runs once in desktop Chromium.",
  );
  const json = JSON.stringify({ payload: "x".repeat(260_000) });
  await openMarkdownFiles(page, [
    { name: "generated.md", markdown: `\`\`\`json\n${json}\n\`\`\`` },
    { name: "generated.json", markdown: json },
  ]);

  for (const name of ["generated.md", "generated.json"]) {
    await page.getByRole("button", { name: `Open ${name}` }).click();
    await expect(page.getByTestId("large-json-preview")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("checkbox", { name: "Line numbers" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-source-line-number]")).toHaveCount(0);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator(".markdown-line-number-gutter")).toHaveCount(0);
    await expect(page.locator(".markdown-line-number-metric")).toHaveCount(0);
  }
});

test("line-number preference follows modes and document switches", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Session persistence runs once in desktop Chromium.",
  );
  await openMarkdownFiles(page, [
    { name: "alpha.md", markdown: "# Alpha" },
    { name: "bravo.md", markdown: "# Bravo" },
  ]);
  await page.getByRole("button", { name: "Open alpha.md" }).click();
  await expect(page.locator(".markdown-surface")).toBeVisible();
  await showLineNumbers(page);
  await expect(page.locator('[data-source-line-number="1"]')).toBeVisible();

  await page.getByRole("button", { name: "LinkedIn", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Line numbers" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open bravo.md" }).click();
  const control = page.getByRole("checkbox", { name: "Line numbers" });
  await expect(control).toBeChecked();
  await expect(page.locator('[data-source-line-number="1"]')).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".markdown-line-number-gutter")).toBeVisible();
});

test("hosted phone exposes the checkable control without toolbar overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-safari",
    "Hosted phone contract runs in mobile Safari.",
  );
  await page.setViewportSize({ width: 375, height: 800 });
  await openMarkdown(page, "phone.md", "# Phone\n\nParagraph");
  const actions = page.locator(".preview-toolbar-actions");
  const surface = page.locator(".markdown-surface");
  const layout = await page.evaluate(() => {
    const actionBand = document.querySelector(
      ".preview-toolbar-actions",
    ) as HTMLElement;
    const markdownSurface = document.querySelector(
      ".markdown-surface",
    ) as HTMLElement;
    return {
      actionsClientWidth: actionBand.clientWidth,
      actionsScrollWidth: actionBand.scrollWidth,
      surfaceWidth: markdownSurface.getBoundingClientRect().width,
    };
  });
  expect(layout.actionsScrollWidth).toBeLessThanOrEqual(layout.actionsClientWidth);
  expect(layout.surfaceWidth).toBeGreaterThanOrEqual(280);
  await expect(actions).toBeVisible();
  await expect(surface).toBeVisible();

  await page.getByRole("button", { name: "More actions" }).click();
  const item = page.getByRole("menuitemcheckbox", { name: "Line numbers" });
  await expect(item).toHaveAttribute("aria-checked", "false");
  await expect(item.locator(".preview-overflow-check-slot svg")).toHaveCount(0);
  await item.click();
  await expect(page.locator('[data-source-line-number="1"]')).toBeVisible();
  await page.getByRole("button", { name: "More actions" }).click();
  const checkedItem = page.getByRole("menuitemcheckbox", {
    name: "Line numbers",
  });
  await expect(checkedItem).toHaveAttribute("aria-checked", "true");
  await expect(checkedItem.locator(".preview-overflow-check-slot svg")).toBeVisible();
  const checkedBackground = await checkedItem.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await checkedItem.hover();
  await expect
    .poll(() =>
      checkedItem.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe(checkedBackground);
  await page.mouse.move(0, 0);
  await checkedItem.focus();
  await expect
    .poll(() =>
      checkedItem.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe(checkedBackground);
});

test("virtualized table fallback keeps its row marker visible", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Virtualized fallback geometry runs once in desktop Chromium.",
  );
  const markdown = [
    "# Report",
    "",
    `| Package-${"wide".repeat(120)} | License-${"wide".repeat(120)} |`,
    "| --- | --- |",
    ...Array.from({ length: 1_100 }, (_, index) => `| pkg-${index} | MIT |`),
  ].join("\n");
  await openMarkdown(page, "report.md", markdown);
  await showLineNumbers(page);
  await expect(page.getByText(/virtualized table/)).toBeVisible();
  const surface = page.locator(".markdown-surface-large-document");
  const headerCell = page.locator(
    ".large-markdown-table th[data-source-line-number]",
  );
  const firstCell = page.locator(".large-markdown-table td[data-source-line-number]").first();
  await expect(headerCell).toHaveAttribute("data-source-line-number", "3");
  await expect(firstCell).toHaveAttribute("data-source-line-number", "5");
  const fallback = await firstCell.evaluate((element) => ({
    content: getComputedStyle(element, "::before").content,
    tableOverflow: getComputedStyle(element.closest("table") as Element).overflow,
    headerPosition: getComputedStyle(
      element.closest("table")?.querySelector("thead") as Element,
    ).position,
    cellPosition: getComputedStyle(element).position,
  }));
  expect(fallback.content).toContain("5");
  expect(fallback.tableOverflow).toBe("visible");
  expect(fallback.headerPosition).toBe("sticky");
  expect(fallback.cellPosition).toBe("static");

  const selectors = {
    heading: ".markdown-surface-large-document h1[data-source-line-number]",
    header: ".large-markdown-table th[data-source-line-number]",
    row: ".large-markdown-table td[data-source-line-number]",
  };
  const beforeScroll = await paintedBeforeBoxes(page, selectors);
  const beforeLefts = Object.values(beforeScroll).map((box) => box.left);
  expect(Math.max(...beforeLefts) - Math.min(...beforeLefts)).toBeLessThanOrEqual(1);

  const scrollTarget = await surface.evaluate((element) => {
    const left = Math.min(240, element.scrollWidth - element.clientWidth);
    const top = Math.min(3_000, element.scrollHeight - element.clientHeight);
    element.scrollLeft = left;
    element.scrollTop = top;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return { left, top };
  });
  expect(scrollTarget.left).toBeGreaterThan(0);
  expect(scrollTarget.top).toBeGreaterThan(0);
  await expect
    .poll(() => surface.evaluate((element) => element.scrollLeft))
    .toBe(scrollTarget.left);
  await expect
    .poll(() => surface.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget.top);
  await expect.poll(() => firstCell.getAttribute("data-source-line-number")).not.toBe("5");

  const afterScroll = await paintedBeforeBoxes(page, selectors);
  const afterLefts = Object.values(afterScroll).map((box) => box.left);
  expect(Math.max(...afterLefts) - Math.min(...afterLefts)).toBeLessThanOrEqual(1);
  const headerBox = await headerCell.boundingBox();
  expect(afterScroll.header.top).toBeGreaterThanOrEqual((headerBox?.y ?? 0) - 1);
  expect(afterScroll.header.bottom).toBeLessThanOrEqual(
    (headerBox?.y ?? 0) + (headerBox?.height ?? 0) + 1,
  );
});

test("line-number padding preserves the Edit to View to Edit anchor", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The canonical real-layout anchor tolerance is validated in desktop Chromium.",
  );
  const markdown = Array.from(
    { length: 180 },
    (_, index) => `Paragraph ${index + 1}. ${"Measured prose ".repeat(8)}`,
  ).join("\n\n");
  await openMarkdown(page, "anchor.md", markdown);
  await showLineNumbers(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const textarea = page.getByRole("textbox", { name: "Edit markdown" });
  await textarea.evaluate((element) => {
    const editor = element as HTMLTextAreaElement;
    editor.scrollTop = 1_600;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const captured = await topSourceLineFromEditor(page);
  expect(captured).toBeGreaterThan(1);

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.locator(".markdown-surface-with-line-numbers")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  const restored = await topSourceLineFromEditor(page);
  expect(Math.abs(restored - captured)).toBeLessThanOrEqual(3);
});

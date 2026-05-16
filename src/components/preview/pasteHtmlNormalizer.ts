import { getDomParser } from "../../converters/runtime";

const BOLD_WEIGHT_THRESHOLD = 600;
const H1_FONT_SIZE_PT = 18;
const H2_FONT_SIZE_PT = 15.5;
const CHECKED_CHECKBOX_PLACEHOLDER = "DOC2MDPASTECHECKBOXCHECKED";
const OPEN_CHECKBOX_PLACEHOLDER = "DOC2MDPASTECHECKBOXOPEN";
const CHECKBOX_PLACEHOLDERS = [
  CHECKED_CHECKBOX_PLACEHOLDER,
  OPEN_CHECKBOX_PLACEHOLDER,
] as const;
const GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE = "data-doc2md-list-level";
const GOOGLE_DOCS_LIST_ITEM_CLASS_PATTERN = /(?:^|\s)li-bullet-(\d+)(?:\s|$)/;
const BLOCK_SELECTOR = [
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
].join(",");

function getStyleDeclarationValue(style: string, propertyName: string) {
  const property = propertyName.toLowerCase();
  const declaration = style
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.split(":", 1)[0]?.trim().toLowerCase() === property);

  if (!declaration) return "";

  return declaration.slice(declaration.indexOf(":") + 1).trim().toLowerCase();
}

function getInlineStyle(element: Element, propertyName: string) {
  const style = element.getAttribute("style");
  if (!style) return "";

  return getStyleDeclarationValue(style, propertyName);
}

function getCssClassStyles(document: Document) {
  const classStyles = new Map<string, string>();
  const classRulePattern = /\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;

  Array.from(document.querySelectorAll("style")).forEach((styleElement) => {
    const cssText = styleElement.textContent ?? "";
    let match: RegExpExecArray | null;

    while ((match = classRulePattern.exec(cssText))) {
      classStyles.set(match[1], match[2]);
    }
  });

  return classStyles;
}

function getClassStyle(
  element: Element,
  propertyName: string,
  classStyles: Map<string, string>,
) {
  for (const className of Array.from(element.classList)) {
    const value = getStyleDeclarationValue(
      classStyles.get(className) ?? "",
      propertyName,
    );
    if (value) return value;
  }

  return "";
}

function cssLengthToPoints(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem)?$/);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = match[2] ?? "px";
  if (unit === "pt") return amount;
  if (unit === "em" || unit === "rem") return amount * 12;
  return amount * 0.75;
}

function listLevelFromMarginLeft(value: string) {
  const points = cssLengthToPoints(value);
  if (points === null || points <= 0) return null;

  return Math.max(0, Math.round(points / 36) - 1);
}

function getGoogleDocsListItemLevel(
  listItem: Element,
  classStyles: Map<string, string>,
) {
  const classLevel = (listItem.getAttribute("class") ?? "").match(
    GOOGLE_DOCS_LIST_ITEM_CLASS_PATTERN,
  );
  if (classLevel) return Number.parseInt(classLevel[1], 10);

  const inlineMarginLevel = listLevelFromMarginLeft(
    getInlineStyle(listItem, "margin-left"),
  );
  if (inlineMarginLevel !== null) return inlineMarginLevel;

  const classMarginLevel = listLevelFromMarginLeft(
    getClassStyle(listItem, "margin-left", classStyles),
  );
  if (classMarginLevel !== null) return classMarginLevel;

  return null;
}

function annotateGoogleDocsListLevels(document: Document) {
  const classStyles = getCssClassStyles(document);
  const listItems = Array.from(document.body.querySelectorAll("li"));

  listItems.forEach((listItem) => {
    const level = getGoogleDocsListItemLevel(listItem, classStyles);
    if (level === null) return;

    listItem.setAttribute(GOOGLE_DOCS_LIST_LEVEL_ATTRIBUTE, String(level));
  });
}

function fontWeightLooksBold(value: string) {
  if (value === "bold" || value === "bolder") return true;

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric >= BOLD_WEIGHT_THRESHOLD;
}

function elementLooksBold(element: Element) {
  return fontWeightLooksBold(getInlineStyle(element, "font-weight"));
}

function elementLooksItalic(element: Element) {
  return getInlineStyle(element, "font-style") === "italic";
}

function fontSizeToPoints(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|pt|em|rem)?$/);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = match[2] ?? "px";
  if (unit === "pt") return amount;
  if (unit === "em" || unit === "rem") return amount * 12;
  return amount * 0.75;
}

function headingLevelForParagraph(paragraph: Element) {
  const candidates = [paragraph, ...Array.from(paragraph.querySelectorAll("span"))];
  let largestBoldSize = 0;

  for (const candidate of candidates) {
    if (!elementLooksBold(candidate)) continue;

    const fontSize = fontSizeToPoints(getInlineStyle(candidate, "font-size"));
    if (fontSize === null) continue;

    largestBoldSize = Math.max(largestBoldSize, fontSize);
  }

  if (largestBoldSize >= H1_FONT_SIZE_PT) return "h1";
  if (largestBoldSize >= H2_FONT_SIZE_PT) return "h2";
  return null;
}

function moveChildren(source: Element, destination: Element) {
  while (source.firstChild) {
    destination.appendChild(source.firstChild);
  }
}

function replaceHeadingParagraphs(document: Document) {
  const paragraphs = Array.from(document.body.querySelectorAll("p"));

  paragraphs.forEach((paragraph) => {
    const headingTag = headingLevelForParagraph(paragraph);
    if (!headingTag) return;

    const heading = document.createElement(headingTag);
    moveChildren(paragraph, heading);
    paragraph.replaceWith(heading);
  });
}

function replaceCheckboxes(document: Document) {
  const checkboxes = Array.from(
    document.body.querySelectorAll('li input[type="checkbox"]'),
  );

  checkboxes.forEach((checkbox) => {
    const marker = checkbox.hasAttribute("checked")
      ? CHECKED_CHECKBOX_PLACEHOLDER
      : OPEN_CHECKBOX_PLACEHOLDER;
    checkbox.replaceWith(document.createTextNode(`${marker} `));
  });

  const checkboxImages = Array.from(document.body.querySelectorAll("li img"));

  checkboxImages.forEach((image) => {
    const alt = (image.getAttribute("alt") ?? "").trim().toLowerCase();
    if (alt !== "checked" && alt !== "unchecked") return;

    const marker =
      alt === "checked" ? CHECKED_CHECKBOX_PLACEHOLDER : OPEN_CHECKBOX_PLACEHOLDER;
    image.replaceWith(document.createTextNode(`${marker} `));
  });
}

function isCheckboxListItem(listItem: Element) {
  const text = (listItem.textContent ?? "").trimStart();
  return CHECKBOX_PLACEHOLDERS.some((placeholder) => text.startsWith(placeholder));
}

function unwrapElement(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function unwrapTaskListItemBlocks(document: Document) {
  const listItems = Array.from(document.body.querySelectorAll("li"));

  listItems.forEach((listItem) => {
    if (!isCheckboxListItem(listItem)) return;

    const blockChildren = Array.from(
      listItem.querySelectorAll("p,div"),
    ).filter((element) => !element.querySelector("ul,ol,table"));

    blockChildren.forEach((element) => {
      if (element.previousSibling?.textContent?.trim().length) {
        element.before(document.createTextNode(" "));
      }
      unwrapElement(element);
    });
  });
}

function unwrapBlockStyleContainers(document: Document) {
  const containers = Array.from(document.body.querySelectorAll("strong,b,em,i"));

  containers.forEach((container) => {
    if (container.querySelector(BLOCK_SELECTOR)) {
      unwrapElement(container);
    }
  });
}

function semanticReplacementForSpan(
  document: Document,
  span: HTMLSpanElement,
  options: { bold: boolean; italic: boolean },
) {
  let root: Element | null = null;
  let leaf: Element | null = null;

  if (options.bold) {
    root = document.createElement("strong");
    leaf = root;
  }

  if (options.italic) {
    const em = document.createElement("em");
    if (leaf) {
      leaf.appendChild(em);
    } else {
      root = em;
    }
    leaf = em;
  }

  if (!root || !leaf) return null;

  moveChildren(span, leaf);
  return root;
}

function replaceInlineStyleSpans(document: Document) {
  const spans = Array.from(document.body.querySelectorAll("span"));

  spans.forEach((span) => {
    if (span.closest("h1,h2,h3,h4,h5,h6")) return;

    const bold = elementLooksBold(span) && !span.closest("strong,b");
    const italic = elementLooksItalic(span) && !span.closest("em,i");
    const replacement = semanticReplacementForSpan(document, span, {
      bold,
      italic,
    });

    if (replacement) {
      span.replaceWith(replacement);
    }
  });
}

export function normalizePasteHtmlForMarkdown(html: string) {
  const DOMParserCtor = getDomParser();
  const parser = new DOMParserCtor();
  const document = parser.parseFromString(html, "text/html");

  annotateGoogleDocsListLevels(document);
  replaceCheckboxes(document);
  unwrapTaskListItemBlocks(document);
  unwrapBlockStyleContainers(document);
  replaceHeadingParagraphs(document);
  replaceInlineStyleSpans(document);

  return document.body.innerHTML;
}

export function restorePasteMarkdownPlaceholders(markdown: string) {
  return markdown
    .replace(new RegExp(CHECKED_CHECKBOX_PLACEHOLDER, "g"), "[x]")
    .replace(new RegExp(OPEN_CHECKBOX_PLACEHOLDER, "g"), "[ ]")
    .replace(
      /^(\s*[-*+]\s+\[[ xX]\])\s*\n(?:[ \t]*\n)*(?![ \t]*(?:[-*+]\s|\d+\.\s|>\s))[ \t]+/gm,
      "$1 ",
    )
    .replace(
      /^((?: {4})*[-*+]\s+\[[ xX]\].*)\n{2,}(?=(?: {4})*[-*+]\s+\[[ xX]\])/gm,
      "$1\n",
    )
    .replace(/\\([–—])/g, "$1");
}

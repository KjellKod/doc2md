import { getDomParser } from "../../converters/runtime";

const BOLD_WEIGHT_THRESHOLD = 600;
const H1_FONT_SIZE_PT = 18;
const H2_FONT_SIZE_PT = 15.5;
const CHECKED_CHECKBOX_PLACEHOLDER = "DOC2MDPASTECHECKBOXCHECKED";
const OPEN_CHECKBOX_PLACEHOLDER = "DOC2MDPASTECHECKBOXOPEN";
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

function getInlineStyle(element: Element, propertyName: string) {
  const style = element.getAttribute("style");
  if (!style) return "";

  const property = propertyName.toLowerCase();
  const declaration = style
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.split(":", 1)[0]?.trim().toLowerCase() === property);

  if (!declaration) return "";

  return declaration.slice(declaration.indexOf(":") + 1).trim().toLowerCase();
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

function unwrapElement(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
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

  replaceCheckboxes(document);
  unwrapBlockStyleContainers(document);
  replaceHeadingParagraphs(document);
  replaceInlineStyleSpans(document);

  return document.body.innerHTML;
}

export function restorePasteMarkdownPlaceholders(markdown: string) {
  return markdown
    .replace(new RegExp(CHECKED_CHECKBOX_PLACEHOLDER, "g"), "[x]")
    .replace(new RegExp(OPEN_CHECKBOX_PLACEHOLDER, "g"), "[ ]");
}

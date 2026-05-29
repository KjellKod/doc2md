// Shared pure Markdown -> HTML renderer used by BOTH the React app's
// "Export HTML" action and the @doc2md/core CLI. There is exactly one
// renderer so export output cannot drift from Preview mode.
//
// Pipeline (the FIRST step is the content-affecting Preview normalization,
// so export and Preview start from identical Markdown):
//   1. formatPreviewMarkdown(markdown)  — same transform Preview applies
//   2. remark-parse                     — Markdown -> mdast
//   3. remark-gfm                       — tables, task lists, strikethrough
//   4. remark-rehype                    — mdast -> hast (raw HTML -> escaped
//                                         text, matching Preview; NO live markup)
//   5. rehype-slug                      — heading ids for in-document anchors
//   6. export link policy               — shared classifier; disabled links
//                                         become inert anchors (no tooltip
//                                         wrapper, no JS)
//   7. image guard                      — strip any residual <img>
//   8. rehype-stringify                 — hast -> HTML string
//
// Raw HTML passthrough is intentionally absent (no rehype-raw, no
// allowDangerousHtml), so untrusted Markdown cannot inject live markup. Raw
// HTML in the source is rendered as escaped text (see the remark-rehype html
// handler), matching Preview and avoiding silent content loss.

import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Plugin } from "unified";
import type { Element, Parent, Root } from "hast";
import { visit } from "unist-util-visit";
import { formatPreviewMarkdown } from "./previewMarkdown";
import { classifyMarkdownHref } from "./markdownLinks";
import { HTML_EXPORT_STYLES } from "./htmlExportStyles";

export interface MarkdownToHtmlOptions {
  /** true (default) wraps in a self-contained document; false returns a fragment. */
  standalone?: boolean;
  /** Document <title>. When omitted, derived from the first heading. */
  title?: string;
  /** <html lang>. Defaults to "en". */
  lang?: string;
}

const DEFAULT_TITLE = "Document";

// Rehype transform: apply the shared link policy to every <a>.
// - external: keep href, add target=_blank rel="noopener noreferrer"
// - anchor: keep href as-is
// - disabled: drop href, mark aria-disabled, class markdown-disabled-link,
//   preserve original href in data-original-href when present. No tooltip
//   wrapper and no event handlers — the standalone file is inert.
const exportLinkPolicy: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") {
      return;
    }

    const properties = node.properties ?? {};
    const rawHref = properties.href;
    const classification = classifyMarkdownHref(
      typeof rawHref === "string" ? rawHref : undefined,
    );

    if (classification.kind === "external") {
      properties.href = classification.href;
      properties.target = "_blank";
      properties.rel = "noopener noreferrer";
      node.properties = properties;
      return;
    }

    if (classification.kind === "anchor") {
      properties.href = classification.href;
      node.properties = properties;
      return;
    }

    // disabled
    delete properties.href;
    properties.className = mergeClassName(
      properties.className,
      "markdown-disabled-link",
    );
    properties["aria-disabled"] = "true";
    if (classification.href !== null) {
      properties["data-original-href"] = classification.href;
    }
    node.properties = properties;
  });
};

// Rehype transform: remove any residual <img>. Conversion strips images, but
// user-authored Markdown can still contain ![alt](url). The export contract
// is self-contained with no external references, so drop images entirely
// (do NOT fetch, inline, or rewrite them).
const stripImages: Plugin<[], Root> = () => (tree: Root) => {
  visit(
    tree,
    "element",
    (node: Element, index: number | undefined, parent: Parent | undefined) => {
      if (node.tagName === "img" && parent && typeof index === "number") {
        parent.children.splice(index, 1);
        return index;
      }
      return undefined;
    },
  );
};

function mergeClassName(
  existing: Element["properties"][string],
  next: string,
): string {
  if (Array.isArray(existing)) {
    return [...existing.map(String), next].join(" ");
  }
  if (typeof existing === "string" && existing.length > 0) {
    return `${existing} ${next}`;
  }
  return next;
}

function deriveTitleFromMarkdown(markdown: string): string {
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match) {
      // Strip the most common inline Markdown emphasis/code markers so the
      // <title> reads as plain text.
      return match[1].replace(/[*_`]/g, "").trim() || DEFAULT_TITLE;
    }
  }
  return DEFAULT_TITLE;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFragment(normalizedMarkdown: string): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      // Match Preview (react-markdown default): raw HTML is rendered as
      // escaped TEXT, never live markup. With no handler, remark-rehype DROPS
      // html nodes entirely — silently losing block-level raw HTML such as
      // <div>x</div> and diverging from Preview, which shows the literal tags.
      // Converting html nodes to text nodes makes rehype-stringify escape
      // them: same visible output as Preview, still injection-safe (no live
      // markup, so no allowDangerousHtml/rehype-raw).
      handlers: {
        html(_state, node: { value?: string }) {
          return { type: "text", value: node.value ?? "" };
        },
      },
    })
    .use(rehypeSlug)
    .use(exportLinkPolicy)
    .use(stripImages)
    .use(rehypeStringify)
    .processSync(normalizedMarkdown);

  return String(file);
}

function wrapStandalone(
  fragment: string,
  title: string,
  lang: string,
): string {
  const safeTitle = escapeHtml(title);
  const safeLang = escapeHtml(lang);
  return `<!DOCTYPE html>
<html lang="${safeLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>${HTML_EXPORT_STYLES}</style>
</head>
<body>
<main class="markdown-surface">
${fragment}
</main>
</body>
</html>
`;
}

export function markdownToHtml(
  markdown: string,
  opts: MarkdownToHtmlOptions = {},
): string {
  const { standalone = true, lang = "en" } = opts;
  // Step 1: normalize through the same content-affecting Preview transform
  // so export matches Preview content exactly.
  const normalizedMarkdown = formatPreviewMarkdown(markdown);
  const fragment = renderFragment(normalizedMarkdown).trim();

  if (!standalone) {
    return fragment;
  }

  const title = opts.title?.trim()
    ? opts.title.trim()
    : deriveTitleFromMarkdown(normalizedMarkdown);

  return wrapStandalone(fragment, title, lang);
}

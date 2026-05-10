import type { Element, Root, RootContent } from "hast";

/**
 * A hand-rolled rehype plugin (no extra dependency) that stamps each
 * top-level block element with `data-source-line="N"`, where N is a
 * 1-based line number in the original (pre-formatting) markdown source.
 *
 * The plugin reads `node.position.start.line` (which mdast-util-to-hast
 * preserves from the parsed mdast tree) — that line number indexes the
 * formatted markdown that ReactMarkdown receives. We translate it back
 * to the original-source line via the caller-provided `originalLineFor`
 * map, where index = formatted line (0-based) and value = original line
 * (1-based). Defensive out-of-range lookups fall back to the formatted
 * line itself.
 *
 * Only top-level elements are stamped; nested blocks inherit their
 * parent's data attribute via DOM hierarchy when readers walk the tree
 * (the consumer needs only one stamp per displayed block).
 */
export function sourceLineRehype(originalLineFor: number[]) {
  return function plugin() {
    return function transformer(tree: Root) {
      for (const node of tree.children) {
        stamp(node, originalLineFor);
      }
    };
  };
}

function stamp(node: RootContent, originalLineFor: number[]) {
  if (node.type !== "element") {
    return;
  }

  const element = node as Element;
  const startLine = element.position?.start?.line;

  if (typeof startLine !== "number" || startLine < 1) {
    return;
  }

  const original =
    originalLineFor[startLine - 1] !== undefined
      ? originalLineFor[startLine - 1]
      : startLine;

  if (!element.properties) {
    element.properties = {};
  }

  element.properties["data-source-line"] = String(original);
}

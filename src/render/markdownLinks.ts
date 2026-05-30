// Shared Markdown link classification policy.
//
// Both Preview mode (react-markdown) and the static HTML export renderer
// classify hrefs identically so the two outputs cannot drift. The visual
// treatment differs (Preview wraps disabled links in a tooltip span with
// click/key guards; export emits an inert anchor), but the classification —
// which links are navigable and which are not — is owned here.
//
//   external — http(s), mailto, tel, or protocol-relative (//...). Opens in
//              the user's default browser. Protocol-relative normalizes to
//              https://.
//   anchor   — pure hash fragment (#section). In-document link; rehype-slug
//              gives every heading a matching id.
//   disabled — everything else: repo-relative paths (../README.md), absolute
//              paths (/foo), relative paths with a hash (../guide.md#section),
//              empty href, and any unknown scheme including data:, blob:,
//              file:, vscode:, and javascript:. doc2md has no file-system
//              path resolver, so following these would navigate to a 404. The
//              original href is preserved (when present) so copy-link still
//              works against a host that can resolve it.

export type MarkdownLinkClassification =
  | { kind: "external"; href: string }
  | { kind: "anchor"; href: string }
  | { kind: "disabled"; href: string | null };

export function classifyMarkdownHref(href: unknown): MarkdownLinkClassification {
  if (typeof href !== "string") {
    return { kind: "disabled", href: null };
  }
  const trimmed = href.trim();
  if (trimmed === "") {
    return { kind: "disabled", href: null };
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("//")) {
    return { kind: "external", href: `https:${trimmed}` };
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return { kind: "external", href: trimmed };
  }
  if (trimmed.startsWith("#")) {
    return { kind: "anchor", href: trimmed };
  }
  return { kind: "disabled", href: trimmed };
}

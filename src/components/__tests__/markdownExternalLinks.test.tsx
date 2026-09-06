import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import PreviewMode from "../preview/PreviewMode";

function makeRef<T>(): { current: T | null } {
  return { current: null };
}

function renderPreview(markdown: string) {
  return render(
    <PreviewMode
      effectiveMarkdown={markdown}
      isFindOpen={false}
      activeFindMatch={null}
      previewRef={makeRef<HTMLDivElement>()}
      renderedViewRef={makeRef<HTMLElement>()}
      pendingAnchorLineRef={{ current: 0 }}
      suppressMatchCenteringForModeSwitchRef={{ current: false }}
      renderedViewText=""
      viewportTopFloor={() => 0}
      onRenderedViewTextChange={() => {}}
    />,
  );
}

describe("PreviewMode markdown anchor handling", () => {
  it("renders a safe explicit target and rewrites its fragment link", () => {
    const { container } = renderPreview(
      '[Jump](#7-2-prove-the-ci-commercial-dmg-build-path)\n\n<a id="7-2-prove-the-ci-commercial-dmg-build-path"></a>\n\n### 7.2 Prove the CI commercial DMG build path',
    );

    expect(container.textContent).not.toContain('<a id="7-2');
    const target = container.querySelector(
      '[id="user-content:7-2-prove-the-ci-commercial-dmg-build-path"]',
    );
    expect(target).not.toBeNull();
    expect(target?.tagName).toBe("A");
    expect(target?.textContent).toBe("");
    expect(target?.hasAttribute("href")).toBe(false);
    expect(target?.classList.contains("markdown-explicit-anchor")).toBe(true);
    expect(target?.classList.contains("markdown-disabled-link")).toBe(false);
    expect(target?.getAttribute("aria-disabled")).toBeNull();
    expect(container.querySelector('a[href="#user-content:7-2-prove-the-ci-commercial-dmg-build-path"]')?.textContent).toBe("Jump");
  });

  it("opens markdown body links in a new tab with safe rel", () => {
    const { container } = renderPreview(
      "Read more at [docs](https://example.com/docs).",
    );
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com/docs");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("opens mailto links in a new tab with safe rel", () => {
    const { container } = renderPreview(
      "Email <hello@example.com>.",
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("mailto:hello@example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each([
    ["Markdown", "[Call](tel:+15555550123)"],
    ["raw HTML", '<a href="tel:+15555550123">Call</a>'],
  ])("opens %s tel links in a new tab with safe rel", (_kind, markdown) => {
    const { container } = renderPreview(markdown);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("tel:+15555550123");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("applies the external policy to raw HTML links", () => {
    const { container } = renderPreview(
      '<a href="https://example.com/raw">Raw docs</a>',
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/raw");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("normalizes protocol-relative links before opening them externally", () => {
    const { container } = renderPreview(
      "Read [docs](//example.com/docs).",
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/docs");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps pure hash links in-shell and unmarked for external open", () => {
    const { container } = renderPreview("Jump to [footnote](#fn-1).");
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("#fn-1");
    expect(anchor?.hasAttribute("target")).toBe(false);
    expect(anchor?.hasAttribute("rel")).toBe(false);
    expect(anchor?.hasAttribute("aria-disabled")).toBe(false);
  });

  it("resolves a hash link to a heading id via rehype-slug", () => {
    // Bug 1: without rehype-slug, the link href existed but no heading
    // carried a matching id, so the browser scrolled to the top of the page.
    const { container } = renderPreview(
      "### Mac Desktop App\n\nSee [the section](#mac-desktop-app).",
    );
    const heading = container.querySelector("h3");
    const link = container.querySelector("a");
    expect(heading?.id).toBe("mac-desktop-app");
    expect(link?.getAttribute("href")).toBe("#mac-desktop-app");
  });

  describe("disabled-link bucket (repo-relative paths)", () => {
    it("renders a repo-relative path as a visibly-disabled link", () => {
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a");
      expect(link).not.toBeNull();
      expect(link?.classList.contains("markdown-disabled-link")).toBe(true);
      expect(link?.getAttribute("aria-disabled")).toBe("true");
      expect(link?.hasAttribute("target")).toBe(false);
      expect(link?.hasAttribute("rel")).toBe(false);
      // Native `title` is intentionally avoided (slow OS tooltip). The
      // project's CSS-only tooltip pattern lives on a sibling span.
      expect(link?.hasAttribute("title")).toBe(false);
      const tooltip = container.querySelector(
        ".markdown-disabled-link-tooltip",
      );
      expect(tooltip).not.toBeNull();
      expect(tooltip?.getAttribute("role")).toBe("tooltip");
      expect(tooltip?.textContent).toContain("Repository link");
    });

    it("preserves the original href so right-click copy-link still works", () => {
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a");
      // We intentionally keep the original href on the disabled anchor:
      // pasting the rendered preview into GitHub's web UI should still
      // produce a navigable link there.
      expect(link?.getAttribute("href")).toBe("../apps/macos/README.md");
    });

    it("intercepts click navigation on a disabled link", () => {
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a") as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      // fireEvent.click returns false when preventDefault was called on the
      // React synthetic event — that's the real path users hit.
      expect(fireEvent.click(link!)).toBe(false);
    });

    it("intercepts middle-click / auxiliary-click on a disabled link", () => {
      // Without onAuxClick, a middle-click would open the preserved href in a
      // new tab in browser-like hosts. testing-library doesn't ship a named
      // helper for auxclick; dispatch the bubbling MouseEvent directly so it
      // reaches the React synthetic-event handler.
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a") as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      const auxEvent = new MouseEvent("auxclick", {
        bubbles: true,
        cancelable: true,
        button: 1,
      });
      const dispatched = fireEvent(link!, auxEvent);
      expect(dispatched).toBe(false);
      expect(auxEvent.defaultPrevented).toBe(true);
    });

    it("intercepts Enter and Space activation on a disabled link", () => {
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a") as HTMLAnchorElement | null;
      expect(link).not.toBeNull();
      expect(fireEvent.keyDown(link!, { key: "Enter" })).toBe(false);
      expect(fireEvent.keyDown(link!, { key: " " })).toBe(false);
      // Other keys must not be intercepted (cursor keys, copy shortcuts, etc).
      expect(fireEvent.keyDown(link!, { key: "ArrowDown" })).toBe(true);
    });

    it("takes the disabled link out of tab order via tabIndex=-1", () => {
      const { container } = renderPreview(
        "Read the [Mac runbook](../apps/macos/README.md).",
      );
      const link = container.querySelector("a");
      expect(link?.getAttribute("tabindex")).toBe("-1");
    });

    it("treats a relative path with a hash as disabled, not as an anchor", () => {
      const { container } = renderPreview(
        "Go to [section](../guide.md#section).",
      );
      const link = container.querySelector("a");
      expect(link?.classList.contains("markdown-disabled-link")).toBe(true);
      expect(link?.getAttribute("aria-disabled")).toBe("true");
      expect(link?.getAttribute("href")).toBe("../guide.md#section");
    });

    it("treats an absolute path as disabled", () => {
      const { container } = renderPreview("See [about](/about).");
      const link = container.querySelector("a");
      expect(link?.classList.contains("markdown-disabled-link")).toBe(true);
      expect(link?.getAttribute("aria-disabled")).toBe("true");
      expect(link?.getAttribute("href")).toBe("/about");
    });

    it("treats a sibling markdown link as disabled", () => {
      const { container } = renderPreview("Open [guide](./guide.md).");
      const link = container.querySelector("a");
      expect(link?.classList.contains("markdown-disabled-link")).toBe(true);
      expect(link?.getAttribute("href")).toBe("./guide.md");
    });

    it("disables an unknown scheme such as javascript:", () => {
      // remark/rehype may strip javascript: to a sanitized href, but the
      // classifier must also catch it independently. The hard invariant is
      // that a javascript:-typed link never becomes an active external link.
      const { container } = renderPreview("[click](javascript:alert(1))");
      // Whatever react-markdown produces (link with sanitized href, link with
      // empty href, or no anchor at all), we must never see an active link.
      expect(container.querySelectorAll('a[target="_blank"]')).toHaveLength(0);
      expect(container.querySelectorAll('a[rel*="noopener"]')).toHaveLength(0);
      // Any anchor that did make it through must carry the disabled class.
      container.querySelectorAll("a").forEach((anchor) => {
        expect(anchor.classList.contains("markdown-disabled-link")).toBe(true);
      });
    });
  });

  describe("rehype-slug heading id behavior", () => {
    it("suffixes duplicate heading slugs so authors can target the second", () => {
      // github-slugger (rehype-slug's engine) appends -1, -2 for repeats so
      // each heading still has a unique id. Authors who want the second
      // occurrence write [link](#mac-desktop-app-1).
      const { container } = renderPreview(
        "### Mac Desktop App\n\n### Mac Desktop App\n",
      );
      const headings = container.querySelectorAll("h3");
      expect(headings).toHaveLength(2);
      expect(headings[0]?.id).toBe("mac-desktop-app");
      expect(headings[1]?.id).toBe("mac-desktop-app-1");
    });

    it("strips inline code, emoji, and non-ASCII when slugging headings", () => {
      // Author writes `### Mac App 🍎 with \`code\`` and the slug omits the
      // emoji + collapses the code text; this test pins current behavior so
      // a future github-slugger upgrade is loud rather than silent.
      const { container } = renderPreview("### Mac App 🍎 with `code`\n");
      const heading = container.querySelector("h3");
      expect(heading?.id).toBe("mac-app--with-code");
    });
  });

  describe("safe raw HTML", () => {
    it("keeps explicit targets out of the keyboard tab order", () => {
      const { container } = renderPreview(
        '<a id="target" tabindex="0" accesskey="k"></a>',
      );
      const target = container.querySelector('[id="user-content:target"]');
      expect(target?.hasAttribute("tabindex")).toBe(false);
      expect(target?.hasAttribute("accesskey")).toBe(false);
      expect(target?.hasAttribute("href")).toBe(false);
    });

    it("keeps explicit targets separate from generated heading ids", () => {
      const { container } = renderPreview(
        '[Explicit](#foo) [Heading](#user-content-foo)\n\n<a id="foo"></a>\n\n### Foo\n\n### User Content Foo',
      );
      expect(container.querySelector('[id="user-content:foo"]')).not.toBeNull();
      expect(container.querySelector('h3[id="foo"]')).not.toBeNull();
      expect(container.querySelector('h3[id="user-content-foo"]')).not.toBeNull();
      expect(container.querySelector('a[href="#user-content:foo"]')?.textContent).toBe("Explicit");
      expect(container.querySelector('a[href="#user-content-foo"]')?.textContent).toBe("Heading");
    });

    it("suffixes repeated explicit ids without emitting duplicates", () => {
      const { container } = renderPreview(
        '<a id="repeat"></a>\n\n<a id="repeat"></a>',
      );
      const ids = Array.from(container.querySelectorAll("[id]"), (node) => node.id);
      expect(ids).toContain("user-content:repeat");
      expect(ids).toContain("user-content:repeat-1");
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("does not double-prefix normalized ids or crash on malformed fragments", () => {
      const { container } = renderPreview(
        '<a id="user-content:ready"></a>\n\n[Ready](#user-content%3Aready) [Malformed](#%ZZ)',
      );
      expect(container.querySelector('[id="user-content:ready"]')).not.toBeNull();
      expect(container.querySelector('[id="user-content:user-content:ready"]')).toBeNull();
      expect(container.querySelector('a[href="#user-content:ready"]')?.textContent).toBe("Ready");
      expect(container.querySelector('a[href="#%ZZ"]')?.textContent).toBe("Malformed");
    });

    it("preserves generated footnote identity and rewrites author ARIA references", () => {
      const { container } = renderPreview(
        'Note[^1]\n\n<h2 id="label">Label</h2>\n\n<table aria-labelledby="label"><tr><td>Cell</td></tr></table>\n\n[^1]: Footnote',
      );
      const reference = container.querySelector("a[data-footnote-ref]");
      const definition = container.querySelector('li[id="user-content-fn-1"]');
      const backReference = container.querySelector('a[data-footnote-backref]');
      expect(reference?.id).toBe("user-content-fnref-1");
      expect(reference?.getAttribute("href")).toBe("#user-content-fn-1");
      expect(reference?.getAttribute("aria-describedby")).toBe("footnote-label");
      expect(definition).not.toBeNull();
      expect(backReference?.getAttribute("href")).toBe("#user-content-fnref-1");
      expect(backReference?.classList.contains("data-footnote-backref")).toBe(true);
      expect(container.querySelector("section.footnotes[data-footnotes]")).not.toBeNull();
      expect(container.querySelector("h2#footnote-label.sr-only")).not.toBeNull();
      expect(container.querySelector('[id="user-content:label"]')).not.toBeNull();
      expect(container.querySelector("table")?.getAttribute("aria-labelledby")).toBe("user-content:label");
    });

    it("does not let forged raw footnotes claim generated ids", () => {
      const { container } = renderPreview(
        'Note[^1]\n\n<a id="user-content-fn-1" data-footnote-ref>Forged</a>\n\n<a name="legacy"></a>\n\n[^1]: Real footnote',
      );
      expect(container.querySelectorAll('[id="user-content-fn-1"]')).toHaveLength(1);
      expect(container.querySelector('li[id="user-content-fn-1"]')?.textContent).toContain("Real footnote");
      expect(container.querySelector('[id="user-content:user-content-fn-1"]')?.textContent).toBe("Forged");
      expect(container.querySelector("[name]")).toBeNull();
    });

    it("allows semantic HTML, unwraps benign containers, and removes executable content", () => {
      const { container } = renderPreview(
        'Before <strong>strong</strong>.\n\n<div class="note">kept child</div>\n\n<script>removed script text</script>',
      );
      expect(container.querySelector("strong")?.textContent).toBe("strong");
      expect(container.querySelector("div.note")).toBeNull();
      expect(container.textContent).toContain("kept child");
      expect(container.querySelector("script")).toBeNull();
      expect(container.textContent).not.toContain("removed script text");
    });

    it("removes dangerous elements, attributes, and URL schemes", () => {
      const { container } = renderPreview(
        '<style>.x{color:red}</style><iframe src="https://example.com"></iframe><form><button>Send</button></form><object>Object</object><embed src="x"><a href="javascript:alert(1)" onclick="alert(1)" style="color:red" ping="https://tracker.example">unsafe</a><picture><source srcset="https://example.com/tracker.png"><img src="https://example.com/fallback.png"></picture>',
      );
      expect(container.querySelector("style, iframe, form, object, embed, picture, source")).toBeNull();
      expect(container.textContent).not.toContain("Send");
      expect(container.textContent).not.toContain("Object");
      const unsafe = Array.from(container.querySelectorAll("a")).find(
        (node) => node.textContent === "unsafe",
      );
      expect(unsafe?.hasAttribute("onclick")).toBe(false);
      expect(unsafe?.hasAttribute("style")).toBe(false);
      expect(unsafe?.hasAttribute("ping")).toBe(false);
      expect(unsafe?.getAttribute("href") ?? "").not.toMatch(/^javascript:/iu);
    });

    it("does not mistake an id-bearing unsafe link for an explicit target", () => {
      const { container } = renderPreview(
        '<a id="unsafe-link" href="javascript:alert(1)">unsafe</a>',
      );
      const link = container.querySelector('[id="user-content:unsafe-link"]');
      expect(link?.classList.contains("markdown-explicit-anchor")).toBe(false);
      expect(link?.classList.contains("markdown-disabled-link")).toBe(true);
      expect(link?.getAttribute("aria-disabled")).toBe("true");
    });
  });

  it("preserves the original href, text, and surrounding markup", () => {
    const { container } = renderPreview(
      "See **[OpenAI](https://openai.com)** announcements.",
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://openai.com");
    expect(link?.textContent).toBe("OpenAI");
    expect(container.querySelector("strong a")).not.toBeNull();
  });

  it("handles a link wrapping inline code", () => {
    const { container } = renderPreview(
      "Check [`@doc2md/core`](https://example.com/core) docs.",
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/core");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("a code")).not.toBeNull();
  });

  it("handles a link wrapping an image", () => {
    const { container } = renderPreview(
      "[![Alt](https://example.com/img.png)](https://example.com/dest)",
    );
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/dest");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("a img")).not.toBeNull();
  });

  it("does not leak the mdast `node` prop onto the rendered anchor", () => {
    const { container } = renderPreview(
      "Visit [the site](https://example.com).",
    );
    const link = container.querySelector("a");
    // react-markdown passes the mdast node as a `node` prop to component
    // overrides. It must be stripped before reaching the DOM so React does
    // not emit "unknown prop" warnings on every rendered link.
    expect(link?.hasAttribute("node")).toBe(false);
  });
});

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
      expect(link?.getAttribute("title")).toContain("Repository link");
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

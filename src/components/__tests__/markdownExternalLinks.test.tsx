import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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

  it("applies the same handling to relative or mailto links", () => {
    const { container } = renderPreview(
      "Email <hello@example.com> or visit [/about](/about).",
    );
    const anchors = container.querySelectorAll("a");
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    anchors.forEach((anchor) => {
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
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
});

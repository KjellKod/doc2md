import { render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useViewportAnchor } from "../preview/useViewportAnchor";

type ViewportAnchorApi = ReturnType<typeof useViewportAnchor<HTMLDivElement>>;

interface RectShape {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

function asDOMRect(rect: RectShape): DOMRect {
  return {
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return rect;
    },
  };
}

function setRect(element: Element, rect: RectShape) {
  element.getBoundingClientRect = vi.fn(() => asDOMRect(rect));
}

function defineScrollBox(element: HTMLElement) {
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 200,
  });
}

function RenderedHarness({
  onReady,
}: {
  onReady: (api: ViewportAnchorApi) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const api = useViewportAnchor(ref, "rendered");

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    setRect(ref.current, {
      top: 100,
      bottom: 300,
      left: 0,
      right: 600,
      width: 600,
      height: 200,
    });
    defineScrollBox(ref.current);
    const stamped = ref.current.querySelectorAll("[data-source-line]");
    setRect(stamped[0], {
      top: 50,
      bottom: 80,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    setRect(stamped[1], {
      top: 130,
      bottom: 160,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    onReady(api);
  }, [api, onReady]);

  return (
    <div ref={ref} data-testid="surface">
      <p data-source-line="1">Alpha</p>
      <p data-source-line="7">Bravo</p>
    </div>
  );
}

function MissingRefHarness({
  onReady,
}: {
  onReady: (api: ViewportAnchorApi) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const api = useViewportAnchor(ref, "rendered");

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useViewportAnchor", () => {
  it("wraps rendered anchor capture and apply without owning scroll math", () => {
    const api: { current: ViewportAnchorApi | null } = { current: null };
    render(<RenderedHarness onReady={(nextApi) => (api.current = nextApi)} />);

    expect(api.current?.captureAnchorLine()).toBe(7);
    expect(api.current?.applyAnchorLine(7)).toBe(true);

    const container = document.querySelector(
      "[data-testid='surface']",
    ) as HTMLDivElement;
    expect(container.scrollTop).toBe(30);
  });

  it("returns false when the destination ref is unavailable", () => {
    const api: { current: ViewportAnchorApi | null } = { current: null };
    render(<MissingRefHarness onReady={(nextApi) => (api.current = nextApi)} />);

    expect(api.current?.captureAnchorLine()).toBeNull();
    expect(api.current?.applyAnchorLine(3)).toBe(false);
  });
});

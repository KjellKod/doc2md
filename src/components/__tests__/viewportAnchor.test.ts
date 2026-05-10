import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  scrollRenderedToLine,
  scrollTextareaToLine,
  topLineFromRendered,
  topLineFromTextareaMirror,
} from "../viewportAnchor";

interface RectShape {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

const elementRects = new WeakMap<Element, RectShape>();
const rangeRects = new WeakMap<Range, RectShape>();

let originalElementRect: typeof Element.prototype.getBoundingClientRect;
let originalRangeRect: typeof Range.prototype.getBoundingClientRect | undefined;
let scrollHeightDescriptor: PropertyDescriptor | undefined;
let clientHeightDescriptor: PropertyDescriptor | undefined;

function asDOMRect(rect: RectShape): DOMRect {
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return rect;
    },
  };
}

function setRect(element: Element, rect: RectShape) {
  elementRects.set(element, rect);
}

function setRangeRect(range: Range, rect: RectShape) {
  rangeRects.set(range, rect);
}

beforeEach(() => {
  originalElementRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    const rect = elementRects.get(this);
    if (rect) {
      return asDOMRect(rect);
    }
    return originalElementRect.call(this);
  };

  originalRangeRect = Range.prototype.getBoundingClientRect;
  Range.prototype.getBoundingClientRect = function () {
    const rect = rangeRects.get(this);
    if (rect) {
      return asDOMRect(rect);
    }
    return asDOMRect({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
    });
  };

  scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollHeight",
  );
  clientHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight",
  );
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalElementRect;
  if (originalRangeRect) {
    Range.prototype.getBoundingClientRect = originalRangeRect;
  } else {
    delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  }

  if (scrollHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollHeight",
      scrollHeightDescriptor,
    );
  }
  if (clientHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientHeight",
      clientHeightDescriptor,
    );
  }
});

function createContainer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  setRect(container, {
    top: 100,
    bottom: 300,
    left: 0,
    right: 600,
    width: 600,
    height: 200,
  });
  return container;
}

function appendStamped(
  container: HTMLElement,
  sourceLine: number,
  rect: RectShape,
  text = `block ${sourceLine}`,
): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute("data-source-line", String(sourceLine));
  element.textContent = text;
  container.appendChild(element);
  setRect(element, rect);
  return element;
}

describe("topLineFromRendered", () => {
  it("returns the source line of the first element at or below the container top", () => {
    const container = createContainer();
    appendStamped(container, 1, {
      top: 50,
      bottom: 80,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 5, {
      top: 110,
      bottom: 140,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 9, {
      top: 200,
      bottom: 230,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });

    expect(topLineFromRendered(container)).toBe(5);
  });

  it("returns the last stamped source line when all elements are above the container top (end-of-doc)", () => {
    const container = createContainer();
    appendStamped(container, 1, {
      top: 0,
      bottom: 30,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 4, {
      top: 30,
      bottom: 60,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 12, {
      top: 60,
      bottom: 90,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });

    expect(topLineFromRendered(container)).toBe(12);
  });

  it("returns 1 when the container has no stamped elements", () => {
    const container = createContainer();
    expect(topLineFromRendered(container)).toBe(1);
  });

  it("skips synthetic-blank stamped lines and prefers a non-blank one at or below the top", () => {
    const container = createContainer();
    appendStamped(
      container,
      3,
      {
        top: 110,
        bottom: 130,
        left: 0,
        right: 600,
        width: 600,
        height: 20,
      },
      "   ",
    );
    appendStamped(container, 4, {
      top: 130,
      bottom: 160,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 9, {
      top: 200,
      bottom: 230,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });

    expect(topLineFromRendered(container)).toBe(4);
  });
});

describe("scrollRenderedToLine", () => {
  it("adjusts scrollTop so the matching element top equals the container top within 1 px", () => {
    const container = createContainer();
    container.scrollTop = 0;
    appendStamped(container, 1, {
      top: 100,
      bottom: 130,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 7, {
      top: 250,
      bottom: 280,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 200,
    });

    scrollRenderedToLine(container, 7);
    // container.top = 100 (from createContainer), element.top = 250.
    // target = 0 + (250 - 100) = 150.
    expect(container.scrollTop).toBe(150);
  });

  it("lands on the closest stamped line at or after the requested anchor", () => {
    const container = createContainer();
    container.scrollTop = 0;
    appendStamped(container, 5, {
      top: 110,
      bottom: 140,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 13, {
      top: 200,
      bottom: 230,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    appendStamped(container, 20, {
      top: 300,
      bottom: 330,
      left: 0,
      right: 600,
      width: 600,
      height: 30,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 200,
    });

    // Anchor 12 → smallest stamped >= 12 is 13.
    scrollRenderedToLine(container, 12);
    expect(container.scrollTop).toBe(100);
  });
});

describe("topLineFromTextareaMirror", () => {
  it("returns the correct line for first/middle/last via Range rect mocks", () => {
    const source = "line one\nline two\nline three";
    const textarea = document.createElement("textarea");
    textarea.value = source;
    document.body.appendChild(textarea);
    Object.defineProperty(textarea, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    const mirror = document.createElement("pre");
    document.body.appendChild(mirror);
    setRect(mirror, {
      top: 100,
      bottom: 200,
      left: 0,
      right: 400,
      width: 400,
      height: 100,
    });
    Object.defineProperty(mirror, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    const text = document.createTextNode(source);
    mirror.appendChild(text);

    // Scenario A: first character at top → returns line 1
    const originalCreateRange = document.createRange;
    let callIndex = 0;
    const characterTops = [
      // We expect the helper to walk character by character; provide tops
      // for the relevant characters. Mirror top is 100 with epsilon 4
      // (so first character whose top >= 96 wins).
      100, // 'l'
    ];
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      const top =
        callIndex < characterTops.length ? characterTops[callIndex] : 999;
      setRangeRect(range, {
        top,
        bottom: top + 20,
        left: 0,
        right: 10,
        width: 10,
        height: 20,
      });
      callIndex += 1;
      return range;
    };

    expect(topLineFromTextareaMirror(textarea, mirror, source)).toBe(1);

    // Scenario B: walk past first line so first qualifying char is in line 2.
    // Wrap createRange to assign a rect *after* setStart is called by the
    // helper. We do this by overriding setStart on each created range.
    callIndex = 0;
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      const originalSetStart = range.setStart.bind(range);
      range.setStart = function (node: Node, offset: number) {
        originalSetStart(node, offset);
        // Source is "line one\nline two\nline three" — offset 9 starts
        // "line two". Chars 0-8 land above (top=50); chars 9+ land at
        // top=110 (qualifies at containerTop - epsilon = 96).
        const top = offset >= 9 ? 110 : 50;
        setRangeRect(range, {
          top,
          bottom: top + 20,
          left: 0,
          right: 10,
          width: 10,
          height: 20,
        });
      };
      return range;
    };

    expect(topLineFromTextareaMirror(textarea, mirror, source)).toBe(2);

    // Scenario C: all rects above container → fallback to last line
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      setRangeRect(range, {
        top: 50,
        bottom: 70,
        left: 0,
        right: 10,
        width: 10,
        height: 20,
      });
      return range;
    };

    expect(topLineFromTextareaMirror(textarea, mirror, source)).toBe(3);

    // Scenario D: soft-wrapped paragraph straddling top — the first
    // character of the wrapped paragraph still maps to a line whose
    // source-text offset is < a newline boundary. Our helper is offset
    // based, so the line returned is whichever line the offset falls on.
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      const originalSetStart = range.setStart.bind(range);
      range.setStart = function (node: Node, offset: number) {
        originalSetStart(node, offset);
        // Source line 2 is offsets 9..16; find the first offset >= 12 with
        // top >= 100 (mid-line wrap point).
        const top = offset >= 12 ? 110 : 50;
        setRangeRect(range, {
          top,
          bottom: top + 20,
          left: 0,
          right: 10,
          width: 10,
          height: 20,
        });
      };
      return range;
    };

    expect(topLineFromTextareaMirror(textarea, mirror, source)).toBe(2);

    document.createRange = originalCreateRange;
  });
});

describe("scrollTextareaToLine", () => {
  it("syncs the mirror, measures the offset y, and sets textarea.scrollTop clamped", () => {
    const source = "alpha\nbravo\ncharlie";
    const textarea = document.createElement("textarea");
    textarea.value = source;
    document.body.appendChild(textarea);
    Object.defineProperty(textarea, "scrollTop", {
      configurable: true,
      writable: true,
      value: 999,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 200,
    });

    const mirror = document.createElement("pre");
    document.body.appendChild(mirror);
    Object.defineProperty(mirror, "scrollTop", {
      configurable: true,
      writable: true,
      value: 999,
    });
    setRect(mirror, {
      top: 100,
      bottom: 300,
      left: 0,
      right: 400,
      width: 400,
      height: 200,
    });
    mirror.appendChild(document.createTextNode(source));

    const originalCreateRange = document.createRange;
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      // Whatever character the helper measures, claim the rect starts at
      // mirror-top + 80 px down (i.e. the third line in this stub).
      setRangeRect(range, {
        top: 180,
        bottom: 200,
        left: 0,
        right: 10,
        width: 10,
        height: 20,
      });
      return range;
    };

    scrollTextareaToLine(textarea, mirror, source, 3);
    // measured top = 180, mirror top = 100, target = 180 - 100 = 80
    // and the helper resets mirror.scrollTop to 0 first.
    expect(mirror.scrollTop).toBe(0);
    expect(textarea.scrollTop).toBe(80);

    document.createRange = originalCreateRange;
  });

  it("falls back to a transient shadow mirror when no permanent mirror is provided", () => {
    const source = "alpha\nbravo\ncharlie";
    const textarea = document.createElement("textarea");
    textarea.value = source;
    document.body.appendChild(textarea);
    Object.defineProperty(textarea, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 200,
    });

    const beforeChildCount = document.body.childElementCount;

    let appendedShadow: HTMLPreElement | null = null;
    const originalAppend = document.body.appendChild.bind(document.body);
    document.body.appendChild = function (node: Node) {
      const result = originalAppend(node);
      if (
        node instanceof HTMLPreElement &&
        node.style.position === "absolute" &&
        node.style.visibility === "hidden"
      ) {
        appendedShadow = node;
        setRect(node, {
          top: 50,
          bottom: 250,
          left: 0,
          right: 400,
          width: 400,
          height: 200,
        });
      }
      return result;
    } as typeof document.body.appendChild;

    const originalCreateRange = document.createRange;
    document.createRange = function () {
      const range = originalCreateRange.call(document);
      setRangeRect(range, {
        top: 90,
        bottom: 110,
        left: 0,
        right: 10,
        width: 10,
        height: 20,
      });
      return range;
    };

    scrollTextareaToLine(textarea, null, source, 2);

    // Shadow was appended and removed — final state has the same child
    // count as before the call (and no extra hidden shadow lingering).
    expect(document.body.childElementCount).toBe(beforeChildCount);
    expect(appendedShadow).not.toBeNull();
    // measured top = 90, mirror top = 50 → target = 40
    expect(textarea.scrollTop).toBe(40);

    document.createRange = originalCreateRange;
    document.body.appendChild = originalAppend;
  });
});

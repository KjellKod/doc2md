import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceResize } from "./useWorkspaceResize";

function keyboardEvent(key: string): KeyboardEvent<HTMLButtonElement> {
  return {
    key,
    preventDefault() {},
  } as unknown as KeyboardEvent<HTMLButtonElement>;
}

describe("useWorkspaceResize per-document height memory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists a keyboard-adjusted height and restores it per document", () => {
    vi.stubGlobal("innerHeight", 1000);
    const store = new Map<string, number | null>();
    const onEditShellHeightChange = vi.fn((key: string, height: number | null) =>
      store.set(key, height),
    );
    const resolveInitialEditShellHeight = (key: string) =>
      store.has(key) ? store.get(key)! : null;

    const { result, rerender } = renderHook(
      ({ documentKey }: { documentKey: string | null }) =>
        useWorkspaceResize({
          documentKey,
          resolveInitialEditShellHeight,
          onEditShellHeightChange,
        }),
      { initialProps: { documentKey: "doc-a" } },
    );

    // Grow the editor on doc A via the keyboard handle.
    act(() => {
      result.current.handleHeightResizeKeyDown(keyboardEvent("ArrowDown"));
    });

    const persistedA = store.get("doc-a");
    expect(typeof persistedA).toBe("number");
    expect(onEditShellHeightChange).toHaveBeenCalledWith("doc-a", persistedA);
    expect(result.current.previewPanelStyle.height).toBe(`${persistedA}px`);

    // Doc B has no remembered height → auto (no inline height).
    rerender({ documentKey: "doc-b" });
    expect(result.current.previewPanelStyle.height).toBeUndefined();

    // Returning to doc A restores its remembered height.
    rerender({ documentKey: "doc-a" });
    expect(result.current.previewPanelStyle.height).toBe(`${persistedA}px`);
  });

  it("resets to auto height when a document height is reset", () => {
    vi.stubGlobal("innerHeight", 1000);
    const store = new Map<string, number | null>();
    const { result } = renderHook(() =>
      useWorkspaceResize({
        documentKey: "doc-a",
        resolveInitialEditShellHeight: (key) =>
          store.has(key) ? store.get(key)! : null,
        onEditShellHeightChange: (key, height) => store.set(key, height),
      }),
    );

    act(() => {
      result.current.handleHeightResizeKeyDown(keyboardEvent("ArrowDown"));
    });
    expect(result.current.previewPanelStyle.height).not.toBeUndefined();

    act(() => {
      result.current.handleHeightResizeReset();
    });
    expect(result.current.previewPanelStyle.height).toBeUndefined();
    expect(store.get("doc-a")).toBeNull();
  });
});

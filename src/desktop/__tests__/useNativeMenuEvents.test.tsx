// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_MENU_EVENTS,
  useNativeMenuEvents,
  type NativeMenuHandlers,
} from "../useNativeMenuEvents";

function NativeMenuProbe({ handlers }: { handlers: NativeMenuHandlers }) {
  useNativeMenuEvents(handlers);
  return null;
}

describe("useNativeMenuEvents", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("dispatches each native menu event to the matching handler", () => {
    const handlers = {
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onRevealInFinder: vi.fn(),
      onCloseWindow: vi.fn(),
    };

    render(<NativeMenuProbe handlers={handlers} />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.closeWindow));

    expect(handlers.onNew).toHaveBeenCalledTimes(1);
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveAs).toHaveBeenCalledTimes(1);
    expect(handlers.onRevealInFinder).toHaveBeenCalledTimes(1);
    expect(handlers.onCloseWindow).toHaveBeenCalledTimes(1);
  });

  it("removes listeners on unmount", () => {
    const handlers = {
      onNew: vi.fn(),
    };
    const { unmount } = render(<NativeMenuProbe handlers={handlers} />);

    unmount();
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(handlers.onNew).not.toHaveBeenCalled();
  });

  it("keeps subscriptions stable while dispatching to the latest handlers", () => {
    const nativeEventNames = new Set<string>(Object.values(NATIVE_MENU_EVENTS));
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const countNativeAdds = () =>
      addSpy.mock.calls.filter(([eventName]) =>
        nativeEventNames.has(String(eventName)),
      ).length;
    const countNativeRemoves = () =>
      removeSpy.mock.calls.filter(([eventName]) =>
        nativeEventNames.has(String(eventName)),
      ).length;
    const firstHandlers = {
      onNew: vi.fn(),
    };
    const nextHandlers = {
      onNew: vi.fn(),
    };
    const { rerender, unmount } = render(
      <NativeMenuProbe handlers={firstHandlers} />,
    );

    expect(countNativeAdds()).toBe(nativeEventNames.size);

    rerender(<NativeMenuProbe handlers={nextHandlers} />);

    expect(countNativeAdds()).toBe(nativeEventNames.size);
    expect(countNativeRemoves()).toBe(0);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(firstHandlers.onNew).not.toHaveBeenCalled();
    expect(nextHandlers.onNew).toHaveBeenCalledTimes(1);

    unmount();

    expect(countNativeRemoves()).toBe(nativeEventNames.size);
  });
});

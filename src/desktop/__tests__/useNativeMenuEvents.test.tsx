// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_MENU_EVENTS,
  WEB_SHELL_READY_EVENT,
  useNativeMenuEvents,
  type NativeMenuHandlers,
} from "../useNativeMenuEvents";
import type { ShellFile, ShellResult } from "../../types/doc2mdShell";

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
      onReload: vi.fn(),
      onRevealInFinder: vi.fn(),
      onCloseWindow: vi.fn(),
    };

    render(<NativeMenuProbe handlers={handlers} />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.reload));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.closeWindow));

    expect(handlers.onNew).toHaveBeenCalledTimes(1);
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveAs).toHaveBeenCalledTimes(1);
    expect(handlers.onReload).toHaveBeenCalledTimes(1);
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

  it("dispatches a web-shell-ready event after native listeners are registered", () => {
    const readyListener = vi.fn();
    window.addEventListener(WEB_SHELL_READY_EVENT, readyListener);

    try {
      render(<NativeMenuProbe handlers={{}} />);
      expect(readyListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(WEB_SHELL_READY_EVENT, readyListener);
    }
  });

  it("posts shell readiness to the native message handler when present", () => {
    const postMessage = vi.fn();
    (
      window as unknown as {
        webkit?: {
          messageHandlers?: { doc2mdShellReady?: { postMessage: typeof postMessage } };
        };
      }
    ).webkit = { messageHandlers: { doc2mdShellReady: { postMessage } } };

    try {
      render(<NativeMenuProbe handlers={{}} />);
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({
        event: WEB_SHELL_READY_EVENT,
        version: 1,
      });
    } finally {
      delete (window as unknown as { webkit?: unknown }).webkit;
    }
  });

  it("passes external-open event detail to the handler", () => {
    const onExternalOpen = vi.fn();
    const handlers: NativeMenuHandlers = { onExternalOpen };
    render(<NativeMenuProbe handlers={handlers} />);

    const result: ShellResult<ShellFile> = {
      ok: true,
      kind: "markdown",
      path: "/Users/me/External.md",
      content: "# External",
      mtimeMs: 5,
      lineEnding: "lf",
    };
    window.dispatchEvent(
      new CustomEvent(NATIVE_MENU_EVENTS.externalOpen, { detail: result }),
    );

    expect(onExternalOpen).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledWith(result);
  });

  it("delivers an external open immediately after readiness emits on first mount", () => {
    const onExternalOpen = vi.fn();
    let dispatchedDuringReady: ShellResult<ShellFile> | null = null;
    const result: ShellResult<ShellFile> = {
      ok: true,
      kind: "markdown",
      path: "/Users/me/AfterReady.md",
      content: "# After ready",
      mtimeMs: 6,
      lineEnding: "lf",
    };

    // Simulate the native side reacting to readiness by immediately dispatching
    // an external open, exercising the handler-ref freshness path on first mount.
    const readyListener = () => {
      dispatchedDuringReady = result;
      window.dispatchEvent(
        new CustomEvent(NATIVE_MENU_EVENTS.externalOpen, { detail: result }),
      );
    };
    window.addEventListener(WEB_SHELL_READY_EVENT, readyListener);

    try {
      render(<NativeMenuProbe handlers={{ onExternalOpen }} />);
    } finally {
      window.removeEventListener(WEB_SHELL_READY_EVENT, readyListener);
    }

    expect(dispatchedDuringReady).toBe(result);
    expect(onExternalOpen).toHaveBeenCalledTimes(1);
    expect(onExternalOpen).toHaveBeenCalledWith(result);
  });
});

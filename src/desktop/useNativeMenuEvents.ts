// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { useEffect, useRef } from "react";
import type { ShellFile, ShellResult } from "../types/doc2mdShell";

export const NATIVE_MENU_EVENTS = {
  new: "doc2md:native-new",
  open: "doc2md:native-open",
  save: "doc2md:native-save",
  saveAs: "doc2md:native-save-as",
  reload: "doc2md:native-reload",
  revealInFinder: "doc2md:native-reveal-in-finder",
  closeWindow: "doc2md:native-close-window",
  externalOpen: "doc2md:native-external-open",
} as const;

// Dispatched after the native event listeners below are registered. It is the
// document-independent readiness signal: the native ExternalOpenRouter only
// flushes buffered Finder opens once it receives the matching WK message, so
// readiness must not depend on a selected document.
export const WEB_SHELL_READY_EVENT = "doc2md:web-shell-ready";

const SHELL_READY_MESSAGE_HANDLER = "doc2mdShellReady";

export interface NativeMenuHandlers {
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onReload?: () => void;
  onRevealInFinder?: () => void;
  onCloseWindow?: () => void;
  onExternalOpen?: (result: ShellResult<ShellFile>) => void;
}

// The native side posts the readiness WK message; this notifies it that the web
// listeners are live. Missing handler (e.g. browser/tests) is a no-op.
function notifyNativeShellReady() {
  const handler = (
    window as unknown as {
      webkit?: {
        messageHandlers?: {
          [SHELL_READY_MESSAGE_HANDLER]?: { postMessage: (body: unknown) => void };
        };
      };
    }
  ).webkit?.messageHandlers?.[SHELL_READY_MESSAGE_HANDLER];

  handler?.postMessage({ event: WEB_SHELL_READY_EVENT, version: 1 });
}

export function useNativeMenuEvents(handlers: NativeMenuHandlers) {
  const handlersRef = useRef(handlers);

  // Keep the ref pointing at the latest handlers without rebinding the
  // window listeners below. eslint-plugin-react-hooks 7's `react-hooks/refs`
  // rule rejects ref writes during render, so do the update after commit.
  //
  // This effect is declared before the listener-registration effect, so on
  // first mount it runs first: the ref is current before the registration
  // effect emits readiness and any native external-open event arrives. That
  // closes the handler-ref freshness race (plan Risk 2 / arbiter backlog).
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const listeners: Array<[string, EventListener]> = [
      [NATIVE_MENU_EVENTS.new, () => handlersRef.current.onNew?.()],
      [NATIVE_MENU_EVENTS.open, () => handlersRef.current.onOpen?.()],
      [NATIVE_MENU_EVENTS.save, () => handlersRef.current.onSave?.()],
      [NATIVE_MENU_EVENTS.saveAs, () => handlersRef.current.onSaveAs?.()],
      [NATIVE_MENU_EVENTS.reload, () => handlersRef.current.onReload?.()],
      [
        NATIVE_MENU_EVENTS.revealInFinder,
        () => handlersRef.current.onRevealInFinder?.(),
      ],
      [
        NATIVE_MENU_EVENTS.closeWindow,
        () => handlersRef.current.onCloseWindow?.(),
      ],
      [
        NATIVE_MENU_EVENTS.externalOpen,
        (event) => {
          const detail = (event as CustomEvent<ShellResult<ShellFile>>).detail;
          if (detail) {
            handlersRef.current.onExternalOpen?.(detail);
          }
        },
      ],
    ];

    for (const [eventName, listener] of listeners) {
      window.addEventListener(eventName, listener);
    }

    // Listeners are live: announce readiness for native flush and for
    // web-side observability/tests.
    window.dispatchEvent(new CustomEvent(WEB_SHELL_READY_EVENT));
    notifyNativeShellReady();

    return () => {
      for (const [eventName, listener] of listeners) {
        window.removeEventListener(eventName, listener);
      }
    };
  }, []);
}

// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { useEffect, useRef } from "react";

export const NATIVE_MENU_EVENTS = {
  new: "doc2md:native-new",
  open: "doc2md:native-open",
  save: "doc2md:native-save",
  saveAs: "doc2md:native-save-as",
  revealInFinder: "doc2md:native-reveal-in-finder",
  closeWindow: "doc2md:native-close-window",
} as const;

export interface NativeMenuHandlers {
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onRevealInFinder?: () => void;
  onCloseWindow?: () => void;
}

export function useNativeMenuEvents(handlers: NativeMenuHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listeners: Array<[string, EventListener]> = [
      [NATIVE_MENU_EVENTS.new, () => handlersRef.current.onNew?.()],
      [NATIVE_MENU_EVENTS.open, () => handlersRef.current.onOpen?.()],
      [NATIVE_MENU_EVENTS.save, () => handlersRef.current.onSave?.()],
      [NATIVE_MENU_EVENTS.saveAs, () => handlersRef.current.onSaveAs?.()],
      [
        NATIVE_MENU_EVENTS.revealInFinder,
        () => handlersRef.current.onRevealInFinder?.(),
      ],
      [
        NATIVE_MENU_EVENTS.closeWindow,
        () => handlersRef.current.onCloseWindow?.(),
      ],
    ];

    for (const [eventName, listener] of listeners) {
      window.addEventListener(eventName, listener);
    }

    return () => {
      for (const [eventName, listener] of listeners) {
        window.removeEventListener(eventName, listener);
      }
    };
  }, []);
}

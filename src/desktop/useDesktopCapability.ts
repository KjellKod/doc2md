// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { useSyncExternalStore } from "react";
import type { Doc2mdShell } from "../types/doc2mdShell";
import { getShell } from "./bridgeClient";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return getShell();
}

function getServerSnapshot() {
  return null;
}

export function useDesktopCapability(): {
  isDesktop: boolean;
  shell: Doc2mdShell | null;
} {
  const shell = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    isDesktop: shell !== null,
    shell,
  };
}

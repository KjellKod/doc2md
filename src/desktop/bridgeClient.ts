// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import type { Doc2mdShell } from "../types/doc2mdShell";

type ShellCandidate = Partial<Record<keyof Doc2mdShell, unknown>>;

function isDoc2mdShell(shell: unknown): shell is Doc2mdShell {
  if (typeof shell !== "object" || shell === null) {
    return false;
  }

  const candidate = shell as ShellCandidate;

  return (
    candidate.version === 2 &&
    typeof candidate.openFile === "function" &&
    typeof candidate.saveFile === "function" &&
    typeof candidate.saveFileAs === "function" &&
    typeof candidate.revealInFinder === "function" &&
    typeof candidate.statFile === "function" &&
    typeof candidate.getPersistenceSettings === "function" &&
    typeof candidate.setPersistenceEnabled === "function" &&
    typeof candidate.setPersistenceTheme === "function"
  );
}

export function getShell(): Doc2mdShell | null {
  if (typeof window === "undefined") {
    return null;
  }

  const shell = window.doc2mdShell as unknown;

  if (!isDoc2mdShell(shell)) {
    return null;
  }

  return shell;
}

export function hasShell() {
  return getShell() !== null;
}

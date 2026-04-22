import type { Doc2mdShell } from "../types/doc2mdShell";

export function getShell(): Doc2mdShell | null {
  if (typeof window === "undefined") {
    return null;
  }

  const shell = window.doc2mdShell;

  if (!shell || shell.version !== 1) {
    return null;
  }

  return shell;
}

export function hasShell() {
  return getShell() !== null;
}

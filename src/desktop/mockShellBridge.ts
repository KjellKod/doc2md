import { vi } from "vitest";
import type {
  Doc2mdShell,
  ShellFile,
  ShellOk,
  ShellRevealOk,
} from "../types/doc2mdShell";

export type MockShellOverrides = Partial<Omit<Doc2mdShell, "version">> & {
  version?: number;
};

const DEFAULT_FILE: ShellFile = {
  ok: true,
  path: "/mock/Untitled.md",
  name: "Untitled.md",
  bytesBase64: "IyBNb2NrIGRvY3VtZW50Cg==",
  mtimeMs: 1,
  lineEnding: "lf",
};

const DEFAULT_SAVE: ShellOk = {
  ok: true,
  path: "/mock/Untitled.md",
  mtimeMs: 2,
};

const DEFAULT_REVEAL: ShellRevealOk = {
  ok: true,
  path: "/mock/Untitled.md",
};

export function createMockShell(
  overrides: MockShellOverrides = {},
): Doc2mdShell {
  return {
    version: (overrides.version ?? 1) as 1,
    openFile: overrides.openFile ?? vi.fn(async () => DEFAULT_FILE),
    saveFile: overrides.saveFile ?? vi.fn(async () => DEFAULT_SAVE),
    saveFileAs: overrides.saveFileAs ?? vi.fn(async () => DEFAULT_SAVE),
    revealInFinder:
      overrides.revealInFinder ?? vi.fn(async () => DEFAULT_REVEAL),
  };
}

export function installMockShell(overrides?: MockShellOverrides) {
  const previousShell = window.doc2mdShell;

  window.doc2mdShell = createMockShell(overrides);

  return () => {
    if (previousShell) {
      window.doc2mdShell = previousShell;
      return;
    }

    delete window.doc2mdShell;
  };
}

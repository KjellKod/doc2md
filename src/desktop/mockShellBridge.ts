import { vi } from "vitest";
import type {
  Doc2mdShell,
  ShellFile,
  ShellSaveOk,
  ShellRevealOk,
} from "../types/doc2mdShell";

export type MockShellOverrides = Partial<Omit<Doc2mdShell, "version">> & {
  version?: number;
};

const DEFAULT_FILE: ShellFile = {
  ok: true,
  kind: "markdown",
  path: "/mock/Untitled.md",
  content: "# Mock document\n",
  mtimeMs: 1,
  lineEnding: "lf",
};

export function createMockImportShellFile(
  overrides: Partial<Extract<ShellFile, { kind: "import-source" }>> = {},
): Extract<ShellFile, { kind: "import-source" }> {
  return {
    ok: true,
    kind: "import-source",
    path: "/mock/Imported.txt",
    name: "Imported.txt",
    format: "txt",
    mtimeMs: 1,
    importUrl: "doc2md://app/__shell/import/mock-token",
    mimeType: "text/plain",
    ...overrides,
  };
}

const DEFAULT_SAVE: ShellSaveOk = {
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
  const installedShell = createMockShell(overrides);
  window.doc2mdShell = installedShell;

  return () => {
    if (window.doc2mdShell !== installedShell) {
      return;
    }

    if (previousShell) {
      window.doc2mdShell = previousShell;
      return;
    }

    delete window.doc2mdShell;
  };
}

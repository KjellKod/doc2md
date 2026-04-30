import { vi } from "vitest";
import type {
  DesktopPersistenceSettings,
  Doc2mdShell,
  ShellFile,
  ShellRevealOk,
  ShellSaveOk,
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

const DEFAULT_PERSISTENCE_SETTINGS: DesktopPersistenceSettings = {
  ok: true,
  persistenceEnabled: false,
  recentFiles: [],
};

export function createMockShell(
  overrides: MockShellOverrides = {},
): Doc2mdShell {
  return {
    version: (overrides.version ?? 2) as 2,
    openFile: overrides.openFile ?? vi.fn(async () => DEFAULT_FILE),
    saveFile: overrides.saveFile ?? vi.fn(async () => DEFAULT_SAVE),
    saveFileAs: overrides.saveFileAs ?? vi.fn(async () => DEFAULT_SAVE),
    revealInFinder:
      overrides.revealInFinder ?? vi.fn(async () => DEFAULT_REVEAL),
    getPersistenceSettings:
      overrides.getPersistenceSettings ??
      vi.fn(async () => DEFAULT_PERSISTENCE_SETTINGS),
    setPersistenceEnabled:
      overrides.setPersistenceEnabled ??
      vi.fn(async (args) => ({
        ...DEFAULT_PERSISTENCE_SETTINGS,
        persistenceEnabled: args.enabled,
      })),
    setPersistenceTheme:
      overrides.setPersistenceTheme ??
      vi.fn(async (args) => ({
        ...DEFAULT_PERSISTENCE_SETTINGS,
        persistenceEnabled: true,
        theme: args.theme,
      })),
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

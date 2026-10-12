// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { describe, expect, it, vi } from "vitest";
import { createMockShell, installMockShell } from "../mockShellBridge";

describe("mockShellBridge", () => {
  it("returns typed default results and records calls", async () => {
    const shell = createMockShell();

    await expect(shell.openFile()).resolves.toMatchObject({
      ok: true,
      kind: "markdown",
      path: "/mock/Untitled.md",
      content: "# Mock document\n",
      lineEnding: "lf",
    });
    await expect(
      shell.saveFile({
        path: "/mock/Untitled.md",
        content: "# Test\n",
        expectedMtimeMs: 1,
        lineEnding: "lf",
      }),
    ).resolves.toEqual({
      ok: true,
      path: "/mock/Untitled.md",
      mtimeMs: 2,
    });
    await expect(
      shell.saveFileAs({
        suggestedName: "Untitled.md",
        content: "# Test\n",
        lineEnding: "lf",
      }),
    ).resolves.toEqual({
      ok: true,
      path: "/mock/Untitled.md",
      mtimeMs: 2,
    });
    await expect(
      shell.revealInFinder({ path: "/mock/Untitled.md" }),
    ).resolves.toEqual({
      ok: true,
      path: "/mock/Untitled.md",
    });
    await expect(shell.getPersistenceSettings()).resolves.toEqual({
      ok: true,
      persistenceEnabled: false,
      recentFiles: [],
    });
    await expect(
      shell.setPersistenceEnabled({ enabled: true }),
    ).resolves.toEqual({
      ok: true,
      persistenceEnabled: true,
      recentFiles: [],
    });
    await expect(shell.setPersistenceTheme({ theme: "light" })).resolves.toEqual({
      ok: true,
      persistenceEnabled: true,
      theme: "light",
      recentFiles: [],
    });
    await expect(shell.clearRecentFiles!()).resolves.toEqual({
      ok: true,
      persistenceEnabled: true,
      recentFiles: [],
    });
    await expect(shell.getSessionState()).resolves.toEqual({
      ok: true,
      openPaths: [],
      recentFiles: [],
    });
    await expect(
      shell.setSessionState({
        openPaths: ["/mock/Untitled.md"],
        selectedPath: "/mock/Untitled.md",
      }),
    ).resolves.toEqual({
      ok: true,
      openPaths: ["/mock/Untitled.md"],
      selectedPath: "/mock/Untitled.md",
      recentFiles: [],
    });

    expect(shell.openFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFileAs).toHaveBeenCalledTimes(1);
    expect(shell.revealInFinder).toHaveBeenCalledTimes(1);
    expect(shell.getPersistenceSettings).toHaveBeenCalledTimes(1);
    expect(shell.setPersistenceEnabled).toHaveBeenCalledTimes(1);
    expect(shell.setPersistenceTheme).toHaveBeenCalledTimes(1);
    expect(shell.clearRecentFiles).toHaveBeenCalledTimes(1);
    expect(shell.getSessionState).toHaveBeenCalledTimes(1);
    expect(shell.setSessionState).toHaveBeenCalledTimes(1);
  });

  it("supports method overrides", async () => {
    const openFile = vi.fn(async () => ({
      ok: false as const,
      code: "cancelled" as const,
    }));
    const shell = createMockShell({ openFile });

    await expect(shell.openFile()).resolves.toEqual({
      ok: false,
      code: "cancelled",
    });
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("moves rename mtimes to the new path with override=%s", async (override) => {
    const shell = createMockShell(override ? {
      renameFile: vi.fn(async () => ({ ok: true as const, path: "/mock/Renamed.md", mtimeMs: 42 })),
    } : {});
    await shell.saveFile({ path: "/mock/Untitled.md", content: "# Saved", expectedMtimeMs: 1, lineEnding: "lf" });
    const result = await shell.renameFile!({ path: "/mock/Untitled.md", name: "Renamed.md", expectedMtimeMs: 2 });
    expect(result.ok).toBe(true);
    await expect(shell.statFile({ path: "/mock/Renamed.md" })).resolves.toMatchObject({ mtimeMs: override ? 42 : 2 });
    await expect(shell.statFile({ path: "/mock/Untitled.md" })).resolves.toMatchObject({ mtimeMs: 1 });
  });

  it("preserves the original mtime when rename fails", async () => {
    const shell = createMockShell({ renameFile: vi.fn(async () => ({ ok: false as const, code: "error" as const, message: "Rename failed" })) });
    await shell.saveFile({ path: "/mock/Untitled.md", content: "# Saved", expectedMtimeMs: 1, lineEnding: "lf" });
    await shell.renameFile!({ path: "/mock/Untitled.md", name: "Renamed.md", expectedMtimeMs: 2 });
    await expect(shell.statFile({ path: "/mock/Untitled.md" })).resolves.toMatchObject({ mtimeMs: 2 });
  });

  it("installs and cleans up the mock shell on window", () => {
    const cleanup = installMockShell();

    expect(window.doc2mdShell?.version).toBe(2);
    expect(window.doc2mdShell?.openFile).toBeDefined();
    expect(window.doc2mdShell?.getPersistenceSettings).toBeDefined();
    expect(window.doc2mdShell?.clearRecentFiles).toBeDefined();
    expect(window.doc2mdShell?.getSessionState).toBeDefined();

    cleanup();
    expect(window.doc2mdShell).toBeUndefined();
  });
});

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

    expect(shell.openFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFileAs).toHaveBeenCalledTimes(1);
    expect(shell.revealInFinder).toHaveBeenCalledTimes(1);
    expect(shell.getPersistenceSettings).toHaveBeenCalledTimes(1);
    expect(shell.setPersistenceEnabled).toHaveBeenCalledTimes(1);
    expect(shell.setPersistenceTheme).toHaveBeenCalledTimes(1);
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

  it("installs and cleans up the mock shell on window", () => {
    const cleanup = installMockShell();

    expect(window.doc2mdShell?.version).toBe(2);
    expect(window.doc2mdShell?.openFile).toBeDefined();
    expect(window.doc2mdShell?.getPersistenceSettings).toBeDefined();

    cleanup();
    expect(window.doc2mdShell).toBeUndefined();
  });
});

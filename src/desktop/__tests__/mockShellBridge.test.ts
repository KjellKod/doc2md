import { describe, expect, it, vi } from "vitest";
import { createMockShell, installMockShell } from "../mockShellBridge";

describe("mockShellBridge", () => {
  it("returns typed default results and records calls", async () => {
    const shell = createMockShell();

    await expect(shell.openFile()).resolves.toMatchObject({
      ok: true,
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

    expect(shell.openFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFile).toHaveBeenCalledTimes(1);
    expect(shell.saveFileAs).toHaveBeenCalledTimes(1);
    expect(shell.revealInFinder).toHaveBeenCalledTimes(1);
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

    expect(window.doc2mdShell?.version).toBe(1);
    expect(window.doc2mdShell?.openFile).toBeDefined();

    cleanup();
    expect(window.doc2mdShell).toBeUndefined();
  });
});

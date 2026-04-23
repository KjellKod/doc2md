import { describe, expect, it, vi } from "vitest";
import type { Doc2mdShell, ShellResult } from "../../types/doc2mdShell";
import { createMockShell } from "../mockShellBridge";
import { transition, type DesktopSaveEvent } from "../saveState";

const saveFileArgs = {
  path: "/mock/Untitled.md",
  content: "# Test\n",
  expectedMtimeMs: 1,
  lineEnding: "lf" as const,
};

const saveFileAsArgs = {
  suggestedName: "Untitled.md",
  content: "# Test\n",
  lineEnding: "lf" as const,
};

const revealArgs = {
  path: "/mock/Untitled.md",
};

function eventForResult<T extends { ok: true }>(
  result: ShellResult<T>,
): DesktopSaveEvent {
  if (result.ok) {
    return "saved";
  }

  return result.code;
}

describe("bridge flows", () => {
  it("returns success shapes for every method", async () => {
    const shell = createMockShell();

    await expect(shell.openFile()).resolves.toMatchObject({
      ok: true,
      path: "/mock/Untitled.md",
      content: "# Mock document\n",
      mtimeMs: 1,
      lineEnding: "lf",
    });
    await expect(shell.saveFile(saveFileArgs)).resolves.toEqual({
      ok: true,
      path: "/mock/Untitled.md",
      mtimeMs: 2,
    });
    await expect(shell.saveFileAs(saveFileAsArgs)).resolves.toEqual({
      ok: true,
      path: "/mock/Untitled.md",
      mtimeMs: 2,
    });

    const revealResult = await shell.revealInFinder(revealArgs);

    expect(revealResult).toEqual({
      ok: true,
      path: "/mock/Untitled.md",
    });
    expect(Object.keys(revealResult).sort()).toEqual(["ok", "path"]);
  });

  it.each([
    {
      method: "openFile",
      shell: createMockShell({
        openFile: vi.fn(async () => ({
          ok: false as const,
          code: "cancelled" as const,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.openFile(),
    },
    {
      method: "saveFile",
      shell: createMockShell({
        saveFile: vi.fn(async () => ({
          ok: false as const,
          code: "cancelled" as const,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFile(saveFileArgs),
    },
    {
      method: "saveFileAs",
      shell: createMockShell({
        saveFileAs: vi.fn(async () => ({
          ok: false as const,
          code: "cancelled" as const,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFileAs(saveFileAsArgs),
    },
    {
      method: "revealInFinder",
      shell: createMockShell({
        revealInFinder: vi.fn(async () => ({
          ok: false as const,
          code: "cancelled" as const,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.revealInFinder(revealArgs),
    },
  ])("resolves $method cancellation results", async ({ shell, call }) => {
    const result = await call(shell);

    expect(result).toEqual({ ok: false, code: "cancelled" });
    expect(transition("saving", eventForResult(result))).toBe("edited");
  });

  it.each([
    {
      method: "openFile",
      shell: createMockShell({
        openFile: vi.fn(async () => ({
          ok: false as const,
          code: "conflict" as const,
          path: "/mock/Untitled.md",
          actualMtimeMs: 3,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.openFile(),
    },
    {
      method: "saveFile",
      shell: createMockShell({
        saveFile: vi.fn(async () => ({
          ok: false as const,
          code: "conflict" as const,
          path: "/mock/Untitled.md",
          actualMtimeMs: 3,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFile(saveFileArgs),
    },
    {
      method: "saveFileAs",
      shell: createMockShell({
        saveFileAs: vi.fn(async () => ({
          ok: false as const,
          code: "conflict" as const,
          path: "/mock/Untitled.md",
          actualMtimeMs: 3,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFileAs(saveFileAsArgs),
    },
    {
      method: "revealInFinder",
      shell: createMockShell({
        revealInFinder: vi.fn(async () => ({
          ok: false as const,
          code: "conflict" as const,
          path: "/mock/Untitled.md",
          actualMtimeMs: 3,
        })),
      }),
      call: (shell: Doc2mdShell) => shell.revealInFinder(revealArgs),
    },
  ])("resolves $method conflict results", async ({ shell, call }) => {
    const result = await call(shell);

    expect(result).toEqual({
      ok: false,
      code: "conflict",
      path: "/mock/Untitled.md",
      actualMtimeMs: 3,
    });
    expect(transition("saving", eventForResult(result))).toBe("conflict");
  });

  it.each([
    {
      method: "openFile",
      shell: createMockShell({
        openFile: vi.fn(async () => ({
          ok: false as const,
          code: "error" as const,
          message: "Not implemented in Phase 2",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.openFile(),
    },
    {
      method: "saveFile",
      shell: createMockShell({
        saveFile: vi.fn(async () => ({
          ok: false as const,
          code: "error" as const,
          message: "Not implemented in Phase 2",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFile(saveFileArgs),
    },
    {
      method: "saveFileAs",
      shell: createMockShell({
        saveFileAs: vi.fn(async () => ({
          ok: false as const,
          code: "error" as const,
          message: "Not implemented in Phase 2",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFileAs(saveFileAsArgs),
    },
    {
      method: "revealInFinder",
      shell: createMockShell({
        revealInFinder: vi.fn(async () => ({
          ok: false as const,
          code: "error" as const,
          message: "Not implemented in Phase 2",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.revealInFinder(revealArgs),
    },
  ])("resolves $method error results", async ({ shell, call }) => {
    const result = await call(shell);

    expect(result).toEqual({
      ok: false,
      code: "error",
      message: "Not implemented in Phase 2",
    });
    expect(transition("saving", eventForResult(result))).toBe("error");
  });

  it.each([
    {
      method: "openFile",
      shell: createMockShell({
        openFile: vi.fn(async () => ({
          ok: false as const,
          code: "permission-needed" as const,
          message: "Select a document again.",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.openFile(),
      expected: {
        ok: false,
        code: "permission-needed",
        message: "Select a document again.",
      },
    },
    {
      method: "saveFile",
      shell: createMockShell({
        saveFile: vi.fn(async () => ({
          ok: false as const,
          code: "permission-needed" as const,
          path: "/mock/Untitled.md",
          message: "Select the document again.",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFile(saveFileArgs),
      expected: {
        ok: false,
        code: "permission-needed",
        path: "/mock/Untitled.md",
        message: "Select the document again.",
      },
    },
    {
      method: "saveFileAs",
      shell: createMockShell({
        saveFileAs: vi.fn(async () => ({
          ok: false as const,
          code: "permission-needed" as const,
          path: "/mock/Untitled.md",
          message: "Select the document again.",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.saveFileAs(saveFileAsArgs),
      expected: {
        ok: false,
        code: "permission-needed",
        path: "/mock/Untitled.md",
        message: "Select the document again.",
      },
    },
    {
      method: "revealInFinder",
      shell: createMockShell({
        revealInFinder: vi.fn(async () => ({
          ok: false as const,
          code: "permission-needed" as const,
          path: "/mock/Untitled.md",
          message: "Select the containing folder again.",
        })),
      }),
      call: (shell: Doc2mdShell) => shell.revealInFinder(revealArgs),
      expected: {
        ok: false,
        code: "permission-needed",
        path: "/mock/Untitled.md",
        message: "Select the containing folder again.",
      },
    },
  ])("resolves $method permission-needed results", async ({
    shell,
    call,
    expected,
  }) => {
    const resultPromise = call(shell);

    await expect(resultPromise).resolves.toEqual(expected);

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("permission-needed");
      if (result.code === "permission-needed") {
        expect(result.path).toBe(expected.path);
        expect(result.message).toBe(expected.message);
      }
    }
    expect(transition("saving", eventForResult(result))).toBe(
      "permission-needed",
    );
  });
});

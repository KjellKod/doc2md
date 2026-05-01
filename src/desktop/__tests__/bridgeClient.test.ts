import { afterEach, describe, expect, it } from "vitest";
import type { Doc2mdShell } from "../../types/doc2mdShell";
import { getShell, hasShell } from "../bridgeClient";
import { createMockShell, installMockShell } from "../mockShellBridge";

describe("bridgeClient", () => {
  afterEach(() => {
    delete window.doc2mdShell;
  });

  it("returns no shell when window.doc2mdShell is missing", () => {
    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();
  });

  it("returns the installed version 2 shell", () => {
    const cleanup = installMockShell();

    expect(hasShell()).toBe(true);
    expect(getShell()).toBe(window.doc2mdShell);

    cleanup();
    expect(getShell()).toBeNull();
  });

  it("ignores shells with incompatible versions", () => {
    const cleanup = installMockShell({ version: 1 });

    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();

    cleanup();
  });

  it("ignores version 2 shells missing persistence methods", () => {
    window.doc2mdShell = {
      ...createMockShell(),
      setPersistenceTheme: undefined,
    } as unknown as Doc2mdShell;

    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();
  });

  it("ignores version 2 shells missing statFile", () => {
    window.doc2mdShell = {
      ...createMockShell(),
      statFile: undefined,
    } as unknown as Doc2mdShell;

    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();
  });
});

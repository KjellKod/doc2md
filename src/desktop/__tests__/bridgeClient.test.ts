import { afterEach, describe, expect, it } from "vitest";
import { getShell, hasShell } from "../bridgeClient";
import { installMockShell } from "../mockShellBridge";

describe("bridgeClient", () => {
  afterEach(() => {
    delete window.doc2mdShell;
  });

  it("returns no shell when window.doc2mdShell is missing", () => {
    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();
  });

  it("returns the installed version 1 shell", () => {
    const cleanup = installMockShell();

    expect(hasShell()).toBe(true);
    expect(getShell()).toBe(window.doc2mdShell);

    cleanup();
    expect(getShell()).toBeNull();
  });

  it("ignores shells with incompatible versions", () => {
    const cleanup = installMockShell({ version: 2 });

    expect(hasShell()).toBe(false);
    expect(getShell()).toBeNull();

    cleanup();
  });
});

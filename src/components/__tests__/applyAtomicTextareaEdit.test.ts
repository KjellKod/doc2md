import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { applyAtomicTextareaEdit } from "../markdownFormatting";

function mountTextarea(initial = "abc"): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.value = initial;
  document.body.appendChild(ta);
  return ta;
}

describe("applyAtomicTextareaEdit", () => {
  let originalExec: typeof document.execCommand;

  beforeEach(() => {
    originalExec = document.execCommand;
  });

  afterEach(() => {
    document.execCommand = originalExec;
    document.querySelectorAll("textarea").forEach((node) => node.remove());
  });

  it("returns ok:true when execCommand reports success", () => {
    const ta = mountTextarea("original");
    document.execCommand = vi.fn().mockImplementation((cmd: string, _ui: boolean, next?: string) => {
      if (cmd === "insertText" && typeof next === "string") {
        ta.value = next;
        return true;
      }
      return false;
    });

    const result = applyAtomicTextareaEdit(ta, "replaced");
    expect(result.ok).toBe(true);
    expect(ta.value).toBe("replaced");
  });

  it("returns ok:false when execCommand returns false", () => {
    const ta = mountTextarea("original");
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = applyAtomicTextareaEdit(ta, "replaced");
    expect(result.ok).toBe(false);
    expect(ta.value).toBe("original");
  });

  it("returns ok:false when execCommand throws", () => {
    const ta = mountTextarea("original");
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("boom");
    });

    const result = applyAtomicTextareaEdit(ta, "replaced");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when focus cannot be acquired (detached textarea)", () => {
    const detached = document.createElement("textarea");
    // Not in DOM, focus is a no-op.
    const result = applyAtomicTextareaEdit(detached, "replaced");
    expect(result.ok).toBe(false);
  });
});

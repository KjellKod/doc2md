import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import App from "../App";

function fireBeforeUnload(): { defaultPrevented: boolean } {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return { defaultPrevented: event.defaultPrevented };
}

describe("App beforeunload guard", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does not prompt when there are no dirty entries", () => {
    render(<App />);
    const { defaultPrevented } = fireBeforeUnload();
    expect(defaultPrevented).toBe(false);
  });

  it("prompts when a scratch entry has unsaved edits", () => {
    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Start writing/i })[0],
    );

    const textarea = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello world" } });

    const { defaultPrevented } = fireBeforeUnload();
    expect(defaultPrevented).toBe(true);
  });

  it("registers the listener while dirty and removes it on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Start writing/i })[0],
    );
    const textarea = screen.getByRole("textbox", {
      name: "Edit markdown",
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "anything" } });

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    // Unmount must remove the listener.
    act(() => cleanup());
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});

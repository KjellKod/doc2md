import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewToolbar from "../PreviewToolbar";
import type { SaveState } from "../../../types/saveState";

// arb-2 (ux-guidebook§4.8): on the compact toolbar path the keyboard-shortcuts
// popover opens from the overflow menu's "Keyboard shortcuts" item, not the
// dedicated shortcuts button (which is never mounted in compact mode). Closing
// the popover must return focus to the overflow trigger that opened it, instead
// of dropping focus to <body>.

function renderCompactToolbar() {
  const toolbarRef = { current: null as HTMLDivElement | null };
  return render(
    <PreviewToolbar
      toolbarRef={toolbarRef}
      mode="edit"
      copyState="idle"
      showToggle
      showCopyButton
      onSave={() => undefined}
      onModeChange={() => undefined}
      onOpenFind={() => undefined}
      onCopy={() => undefined}
      saveBusy={false}
      saveDisabled={false}
      saveState={"idle" as SaveState}
      lastSavedAt={null}
      compactToolbar
    />,
  );
}

describe("PreviewToolbar compact shortcuts focus return", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns focus to the overflow trigger when the shortcuts popover closes via Escape", () => {
    vi.useFakeTimers();
    renderCompactToolbar();

    // Open the overflow menu and pick "Keyboard shortcuts".
    const overflowTrigger = screen.getByRole("button", {
      name: "More actions",
    });
    fireEvent.click(overflowTrigger);
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Keyboard shortcuts" }),
    );

    const popover = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(popover).toBeInTheDocument();

    // Simulate a keyboard/AT user whose focus is inside the dismissible overlay
    // (the dialog is the focus host). When it unmounts on Escape, focus must be
    // explicitly returned — otherwise it falls to <body> (the arb-2 regression).
    popover.setAttribute("tabindex", "-1");
    popover.focus();
    expect(popover).toHaveFocus();

    // Dismiss with Escape from inside the popover.
    fireEvent.keyDown(popover, { key: "Escape" });

    // focusShortcutsTrigger schedules the focus via setTimeout(…, 0).
    vi.runAllTimers();

    // Focus returns to the overflow trigger, NOT <body> (the regression).
    expect(overflowTrigger).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("returns focus to the dedicated shortcuts button on the non-compact path", () => {
    vi.useFakeTimers();
    const toolbarRef = { current: null as HTMLDivElement | null };
    render(
      <PreviewToolbar
        toolbarRef={toolbarRef}
        mode="edit"
        copyState="idle"
        showToggle
        showCopyButton
        onSave={() => undefined}
        onModeChange={() => undefined}
        onOpenFind={() => undefined}
        onCopy={() => undefined}
        saveBusy={false}
        saveDisabled={false}
        saveState={"idle" as SaveState}
        lastSavedAt={null}
      />,
    );

    const shortcutsButton = screen.getByRole("button", {
      name: "Keyboard shortcuts",
    });
    fireEvent.click(shortcutsButton);

    const popover = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    popover.setAttribute("tabindex", "-1");
    popover.focus();
    fireEvent.keyDown(popover, { key: "Escape" });
    vi.runAllTimers();

    expect(shortcutsButton).toHaveFocus();
  });
});

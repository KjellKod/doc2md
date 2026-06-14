import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewOverflowMenu from "./PreviewOverflowMenu";
import type { PreviewOverflowMenuItem } from "./PreviewOverflowMenu";

function buildItems(
  overrides: Partial<Record<string, () => void>> = {},
): PreviewOverflowMenuItem[] {
  return [
    { key: "new", label: "New document", onSelect: overrides.new ?? vi.fn() },
    { key: "find", label: "Find and replace", onSelect: overrides.find ?? vi.fn() },
    {
      key: "shortcuts",
      label: "Keyboard shortcuts",
      onSelect: overrides.shortcuts ?? vi.fn(),
    },
  ];
}

describe("PreviewOverflowMenu (P1 a11y)", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes aria-haspopup/expanded/controls on the trigger", () => {
    render(<PreviewOverflowMenu items={buildItems()} />);
    const trigger = screen.getByRole("button", { name: "More actions" });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");
  });

  it("opens the menu and focuses the first item (AC-P1b)", () => {
    render(<PreviewOverflowMenu items={buildItems()} />);
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "More actions" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "New document" }),
    ).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<PreviewOverflowMenu items={buildItems()} />);
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "New document" }), {
      key: "Escape",
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on outside click without stealing focus", () => {
    render(
      <div>
        <PreviewOverflowMenu items={buildItems()} />
        <button type="button">Outside</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // Outside close does not yank focus back to the trigger.
    expect(trigger).not.toHaveFocus();
  });

  it("wraps Arrow navigation through the items", () => {
    render(<PreviewOverflowMenu items={buildItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const newItem = screen.getByRole("menuitem", { name: "New document" });
    const findItem = screen.getByRole("menuitem", { name: "Find and replace" });
    const shortcuts = screen.getByRole("menuitem", { name: "Keyboard shortcuts" });

    expect(newItem).toHaveFocus();
    fireEvent.keyDown(newItem, { key: "ArrowDown" });
    expect(findItem).toHaveFocus();
    fireEvent.keyDown(findItem, { key: "ArrowDown" });
    expect(shortcuts).toHaveFocus();
    // Wrap back to the first item.
    fireEvent.keyDown(shortcuts, { key: "ArrowDown" });
    expect(newItem).toHaveFocus();
    // ArrowUp wraps to the last item.
    fireEvent.keyDown(newItem, { key: "ArrowUp" });
    expect(shortcuts).toHaveFocus();
  });

  it("traps Tab/Shift+Tab within the open menu", () => {
    render(<PreviewOverflowMenu items={buildItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const newItem = screen.getByRole("menuitem", { name: "New document" });
    const shortcuts = screen.getByRole("menuitem", { name: "Keyboard shortcuts" });

    fireEvent.keyDown(newItem, { key: "Tab", shiftKey: true });
    expect(shortcuts).toHaveFocus();
    fireEvent.keyDown(shortcuts, { key: "Tab" });
    expect(newItem).toHaveFocus();
  });

  it("activates an item with Enter and closes, invoking its callback", () => {
    const onFind = vi.fn();
    render(<PreviewOverflowMenu items={buildItems({ find: onFind })} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const findItem = screen.getByRole("menuitem", { name: "Find and replace" });
    fireEvent.keyDown(findItem, { key: "ArrowDown" }); // focus Find
    fireEvent.keyDown(findItem, { key: "Enter" });

    expect(onFind).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("invokes a clicked item once and closes the menu", () => {
    const onNew = vi.fn();
    render(<PreviewOverflowMenu items={buildItems({ new: onNew })} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "New document" }));

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("skips disabled items during keyboard navigation (no stuck focus)", () => {
    // A disabled item sitting between enabled ones must not trap Arrow/Tab
    // navigation: a disabled <button> cannot receive focus, so including it in
    // the nav list would leave focus stuck on the current item.
    render(
      <PreviewOverflowMenu
        items={[
          { key: "new", label: "New document", onSelect: vi.fn() },
          {
            key: "md",
            label: "Download Markdown",
            onSelect: vi.fn(),
            disabled: true,
          },
          { key: "html", label: "Download HTML", onSelect: vi.fn() },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const newItem = screen.getByRole("menuitem", { name: "New document" });
    const htmlItem = screen.getByRole("menuitem", { name: "Download HTML" });

    expect(newItem).toHaveFocus();
    // ArrowDown skips the disabled "Download Markdown" and lands on HTML.
    fireEvent.keyDown(newItem, { key: "ArrowDown" });
    expect(htmlItem).toHaveFocus();
    // Wrap back to the first enabled item (only two are focusable).
    fireEvent.keyDown(htmlItem, { key: "ArrowDown" });
    expect(newItem).toHaveFocus();
    // ArrowUp also wraps across the disabled item.
    fireEvent.keyDown(newItem, { key: "ArrowUp" });
    expect(htmlItem).toHaveFocus();
  });

  it("does not invoke disabled items", () => {
    const onExport = vi.fn();
    render(
      <PreviewOverflowMenu
        items={[
          { key: "export", label: "Download HTML", onSelect: onExport, disabled: true },
          { key: "find", label: "Find and replace", onSelect: vi.fn() },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    const exportItem = screen.getByRole("menuitem", { name: "Download HTML" });
    expect(exportItem).toBeDisabled();
    fireEvent.click(exportItem);
    expect(onExport).not.toHaveBeenCalled();
  });
});

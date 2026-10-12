import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewToolbar from "./PreviewToolbar";
import type { PreviewToolbarProps } from "./PreviewToolbar";

function setup(overrides: Partial<PreviewToolbarProps> = {}) {
  const host = document.createElement("header");
  document.body.appendChild(host);
  const props: PreviewToolbarProps = {
    toolbarTarget: host,
    toolbarStart: <span>Document title</span>,
    settingsContent: (
      <label>
        Appearance
        <select>
          <option>Night</option>
        </select>
      </label>
    ),
    toolbarRef: { current: null },
    mode: "preview",
    copyState: "idle",
    showToggle: true,
    showCopyButton: true,
    onToggleLineNumbers: vi.fn(),
    showLineNumbers: false,
    onSave: vi.fn(),
    outputMode: "download",
    onDownloadMarkdown: vi.fn(),
    saveBusy: false,
    saveDisabled: false,
    saveState: "saved",
    lastSavedAt: null,
    onExportHtml: vi.fn(),
    onModeChange: vi.fn(),
    onOpenFind: vi.fn(),
    onCopy: vi.fn(),
    ...overrides,
  };
  const result = render(<PreviewToolbar {...props} />);
  return { ...result, host, props };
}
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
describe("combined toolbar", () => {
  it("uses the download icon without routine readiness or edited labels", () => {
    const { props, rerender } = setup();
    expect(screen.queryByText("Ready to download")).not.toBeInTheDocument();
    rerender(<PreviewToolbar {...props} saveState="edited" />);
    expect(screen.queryByText("Not downloaded")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download Markdown" }),
    ).toBeEnabled();
    rerender(<PreviewToolbar {...props} saveDisabled />);
    expect(
      screen.getByRole("button", { name: "Download Markdown" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("tooltip", { name: "Add text to download" }),
    ).toBeInTheDocument();
  });
  it("provides a keyboard-accessible reason for unavailable output", () => {
    setup({ saveDisabled: true });
    const unavailable = screen.getByRole("group", { name: "Download Markdown unavailable" });
    expect(unavailable).toHaveAttribute("tabindex", "0");
    expect(unavailable).toHaveAccessibleDescription("Add text to download");
  });
  it("only advertises an output shortcut when the host implements it", () => {
    const { props, rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByText("Cmd/Ctrl+S")).not.toBeInTheDocument();
    rerender(<PreviewToolbar {...props} outputMode="save" saveKeyShortcuts="Meta+S" />);
    expect(screen.getByText("Cmd+S")).toBeInTheDocument();
  });
  it("hides document commands outside the workspace while retaining settings", () => {
    setup({ documentControlsVisible: false });
    expect(screen.queryByRole("button", { name: "Download Markdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "View mode" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByRole("button", { name: "Download HTML" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Appearance" })).toBeVisible();
  });
  it("portals the document controls into the shell and keeps a single primary output action", () => {
    const { host, props } = setup();
    expect(
      within(host).getByRole("button", { name: "Download Markdown" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
    expect(props.onSave).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "LinkedIn" }));
    expect(props.onModeChange).toHaveBeenCalledWith("linkedin");
    fireEvent.click(screen.getByRole("button", { name: "Find and replace" }));
    expect(props.onOpenFind).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy formatted text" }),
    );
    expect(props.onCopy).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.getAllByRole("button", { name: "Download Markdown" }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "More actions" }),
    ).not.toBeInTheDocument();
  });
  it("keeps preferences open when toggled and restores gear focus on Escape", () => {
    const { props, rerender } = setup();
    const gear = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(gear);
    expect(screen.getByRole("combobox", { name: "Appearance" })).toHaveFocus();
    fireEvent.click(screen.getByRole("checkbox", { name: "Line numbers" }));
    expect(props.onToggleLineNumbers).toHaveBeenCalledOnce();
    rerender(<PreviewToolbar {...props} showLineNumbers />);
    expect(
      screen.getByRole("checkbox", { name: "Line numbers" }),
    ).toBeChecked();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(gear).toHaveFocus();
  });
  it("runs exports through existing callbacks and closes settings", () => {
    const { props } = setup({ outputMode: "save" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Download HTML" }));
    expect(props.onExportHtml).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Settings" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
    expect(props.onDownloadMarkdown).toHaveBeenCalledOnce();
  });
  it("dismisses settings on outside pointer interaction", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole("dialog", { name: "Settings" }),
    ).not.toBeInTheDocument();
  });
  it.each(["settingsContent", "settingsActions"] as const)(
    "dismisses %s command buttons while keeping explicitly persistent actions open",
    (slot) => {
      const openRecent = vi.fn();
      const clearHistory = vi.fn();
      setup({
        [slot]: (
          <>
            <button onClick={openRecent}>Recent document</button>
            <button data-keep-settings-open onClick={clearHistory}>
              Clear history
            </button>
          </>
        ),
      });
      const gear = screen.getByRole("button", { name: "Settings" });
      fireEvent.click(gear);
      fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
      expect(clearHistory).toHaveBeenCalledOnce();
      expect(
        screen.getByRole("dialog", { name: "Settings" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Recent document" }));
      expect(openRecent).toHaveBeenCalledOnce();
      expect(
        screen.queryByRole("dialog", { name: "Settings" }),
      ).not.toBeInTheDocument();
      expect(gear).toHaveFocus();
    },
  );
});

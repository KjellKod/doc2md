import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewToolbar from "./PreviewToolbar";

type ToolbarProps = Parameters<typeof PreviewToolbar>[0];

function baseProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    toolbarRef: { current: null },
    mode: "edit",
    copyState: "idle",
    showToggle: true,
    showCopyButton: true,
    onSave: vi.fn(),
    onDownloadMarkdown: vi.fn(),
    saveBusy: false,
    saveDisabled: false,
    saveState: "saved",
    lastSavedAt: null,
    onExportHtml: vi.fn(),
    onNewDocument: vi.fn(),
    onModeChange: vi.fn(),
    onOpenFind: vi.fn(),
    onCopy: vi.fn(),
    ...overrides,
  };
}

describe("PreviewToolbar render paths (P1)", () => {
  afterEach(() => {
    cleanup();
  });

  describe("non-compact (desktop / bare shells, AC-P1c)", () => {
    it("renders the full second action row with no overflow menu", () => {
      render(<PreviewToolbar {...baseProps({ compactToolbar: false })} />);

      // Primary actions render directly as buttons (two-band layout).
      expect(
        screen.getByRole("button", { name: "New document" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Find and replace" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save document" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download Markdown" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download HTML" }),
      ).toBeInTheDocument();

      // No overflow "More" affordance on desktop.
      expect(
        screen.queryByRole("button", { name: "More actions" }),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector(".preview-toolbar-compact"),
      ).not.toBeInTheDocument();
    });

    it("treats an undefined compactToolbar as the desktop two-band layout", () => {
      render(<PreviewToolbar {...baseProps()} />);
      expect(
        screen.getByRole("button", { name: "Find and replace" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "More actions" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("compact (hosted phones, AC-P1a / F3)", () => {
    it("keeps Edit/View/LinkedIn and Save primary while demoting the rest behind More", () => {
      render(<PreviewToolbar {...baseProps({ compactToolbar: true })} />);

      // Primary cluster: mode toggle stays inline.
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "LinkedIn" }),
      ).toBeInTheDocument();

      // Save stays primary (NOT in the overflow menu) — arbiter F3.
      expect(
        screen.getByRole("button", { name: "Save document" }),
      ).toBeInTheDocument();

      // Demoted actions are NOT rendered as top-level toolbar buttons.
      expect(
        screen.queryByRole("button", { name: "Find and replace" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Download Markdown" }),
      ).not.toBeInTheDocument();

      // They live behind the single overflow trigger.
      const more = screen.getByRole("button", { name: "More actions" });
      fireEvent.click(more);
      expect(
        screen.getByRole("menuitem", { name: "New document" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Find and replace" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Download Markdown" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Download HTML" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Keyboard shortcuts" }),
      ).toBeInTheDocument();
    });

    it("keeps .preview-toolbar-actions populated with >1 child so AC4 stays green (F3)", () => {
      const { container } = render(
        <PreviewToolbar {...baseProps({ compactToolbar: true })} />,
      );
      const actions = container.querySelector(".preview-toolbar-actions");
      expect(actions).not.toBeNull();
      // Save control group + overflow menu = 2 children.
      expect(actions!.children.length).toBeGreaterThan(1);
      // Save feedback signifier (SaveStatePill) rides with Save (F3 / §4.7).
      expect(actions!.querySelector(".save-control-group")).not.toBeNull();
      expect(actions!.querySelector(".preview-overflow-menu")).not.toBeNull();
    });

    it("keeps SaveStatePill so the save-feedback signifier is not dropped", () => {
      const { container } = render(
        <PreviewToolbar
          {...baseProps({ compactToolbar: true, saveState: "edited" })}
        />,
      );
      expect(
        container.querySelector(".save-control-group .save-state-pill"),
      ).not.toBeNull();
    });

    it("opens the keyboard shortcuts popover from the overflow menu", () => {
      render(<PreviewToolbar {...baseProps({ compactToolbar: true })} />);
      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Keyboard shortcuts" }),
      );
      expect(
        screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
      ).toBeInTheDocument();
    });

    it("invokes the demoted callback via its menu item", () => {
      const onOpenFind = vi.fn();
      render(
        <PreviewToolbar {...baseProps({ compactToolbar: true, onOpenFind })} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Find and replace" }),
      );
      expect(onOpenFind).toHaveBeenCalledTimes(1);
    });
  });
});

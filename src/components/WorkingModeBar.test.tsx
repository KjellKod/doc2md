import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkingModeBar from "./WorkingModeBar";
import type { DesktopRecentFile } from "../types/doc2mdShell";

const recentFiles: DesktopRecentFile[] = [
  {
    path: "/Users/me/Alpha.md",
    displayName: "Alpha.md",
    lastOpenedAt: "2026-05-12T22:10:00.000Z",
  },
  {
    path: "/Users/me/Beta.md",
    displayName: "Beta.md",
    lastOpenedAt: "2026-05-12T22:11:00.000Z",
  },
];

function renderBar(overrides: Partial<Parameters<typeof WorkingModeBar>[0]> = {}) {
  const props = {
    variant: "browser" as const,
    onHome: vi.fn(),
    onOpen: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  };

  render(<WorkingModeBar {...props} />);
  return props;
}

describe("WorkingModeBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onHome from the logo", () => {
    const { onHome } = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("opens desktop recent menu with aria-expanded", () => {
    renderBar({
      variant: "desktop",
      recentFiles,
      onOpenRecentFile: vi.fn(),
    });

    const open = screen.getByRole("button", { name: "Open" });
    expect(open).toHaveAttribute("aria-haspopup", "menu");
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(open).toHaveAttribute("aria-controls");

    fireEvent.click(open);

    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Recent files" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Browse..." })).toHaveFocus();
  });

  it("treats empty recents Open as a plain button", () => {
    const { onOpen } = renderBar({
      variant: "desktop",
      recentFiles: [],
      onOpenRecentFile: vi.fn(),
    });

    const open = screen.getByRole("button", { name: "Open" });
    expect(open).not.toHaveAttribute("aria-haspopup");
    expect(open).not.toHaveAttribute("aria-expanded");
    expect(open).not.toHaveAttribute("aria-controls");

    fireEvent.click(open);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes recent menu on Escape and returns focus", () => {
    renderBar({
      variant: "desktop",
      recentFiles,
      onOpenRecentFile: vi.fn(),
    });

    const open = screen.getByRole("button", { name: "Open" });
    fireEvent.click(open);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Browse..." }), {
      key: "Escape",
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("wraps Tab within the recent menu", () => {
    renderBar({
      variant: "desktop",
      recentFiles,
      onOpenRecentFile: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const browse = screen.getByRole("menuitem", { name: "Browse..." });
    const beta = screen.getByRole("menuitem", { name: /Beta\.md/ });

    fireEvent.keyDown(browse, { key: "Tab", shiftKey: true });
    expect(beta).toHaveFocus();

    fireEvent.keyDown(beta, { key: "Tab" });
    expect(browse).toHaveFocus();
  });

  it("moves focus between recent items with arrow keys", () => {
    renderBar({
      variant: "desktop",
      recentFiles,
      onOpenRecentFile: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const browse = screen.getByRole("menuitem", { name: "Browse..." });
    const alpha = screen.getByRole("menuitem", { name: /Alpha\.md/ });
    const beta = screen.getByRole("menuitem", { name: /Beta\.md/ });

    expect(browse).toHaveFocus();
    fireEvent.keyDown(browse, { key: "ArrowDown" });
    expect(alpha).toHaveFocus();
    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect(beta).toHaveFocus();
    fireEvent.keyDown(beta, { key: "ArrowUp" });
    expect(alpha).toHaveFocus();
  });
});

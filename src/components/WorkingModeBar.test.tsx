import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
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

const globalCssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../styles/global.css",
);

function extractRuleBody(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ruleMatch = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return ruleMatch?.[1] ?? "";
}

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

    fireEvent.click(
      screen.getByRole("button", { name: "Show intro and return to landing" }),
    );

    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("renders the full wordmark tagline", () => {
    renderBar();
    expect(screen.getByText("doc2md")).toBeInTheDocument();
    expect(screen.getByText("PRIVATE MARKDOWN WORKSPACE")).toBeInTheDocument();
  });

  it("renders supplied trailing controls after Open and New", () => {
    renderBar({
      trailingControls: (
        <button type="button" aria-label="Switch to night mode">
          Theme
        </button>
      ),
    });

    const buttons = screen.getAllByRole("button");
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toHaveClass(
      "secondary-button",
      "working-mode-button",
    );
    expect(
      screen.getByRole("button", { name: "Switch to night mode" }),
    ).toBeInTheDocument();
    expect(buttons.map((button) => button.textContent)).toEqual([
      "doc2md - PRIVATE MARKDOWN WORKSPACE",
      "Open",
      "New",
      "Theme",
    ]);
    expect(screen.getByRole("link", { name: "Sketch a UI →" })).toBeInTheDocument();
  });

  it("renders the sketch2md cross-product link", () => {
    renderBar();

    const link = screen.getByRole("link", { name: "Sketch a UI →" });

    expect(link).toHaveAttribute("href", "https://sketch2md.dev/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
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

  it("marks unavailable recent files while keeping them retryable", () => {
    const onOpenRecentFile = vi.fn();
    renderBar({
      variant: "desktop",
      recentFiles,
      unavailableRecentPaths: new Set(["/Users/me/Beta.md"]),
      onOpenRecentFile,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const beta = screen.getByRole("menuitem", { name: /Beta\.md/ });

    expect(beta).toHaveClass("is-unavailable");
    expect(beta).toHaveAttribute(
      "title",
      "Not available. Click to retry opening this file.",
    );

    fireEvent.click(beta);

    expect(onOpenRecentFile).toHaveBeenCalledWith("/Users/me/Beta.md");
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

  it("keeps overflow hidden by default but allows it in active working mode for the recent menu", () => {
    const styles = readFileSync(globalCssPath, "utf8");
    const baseBarRule = extractRuleBody(styles, ".working-mode-bar");
    const activeBarRule = extractRuleBody(
      styles,
      ".page.is-working-mode .working-mode-bar",
    );

    expect(baseBarRule).toContain("overflow: hidden;");
    expect(activeBarRule).toContain("overflow: visible;");
  });
});

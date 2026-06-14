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
    expect(beta).not.toHaveAttribute("title");
    const tooltipId = beta.getAttribute("aria-describedby");
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId ?? "")).toHaveAttribute(
      "role",
      "tooltip",
    );
    expect(document.getElementById(tooltipId ?? "")).toHaveClass(
      "recent-file-tooltip",
    );
    expect(document.getElementById(tooltipId ?? "")).toHaveTextContent(
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

  describe("P2 upload reopen via trailingControls (F5 / AC-P2c)", () => {
    it("renders the show-upload control passed through the existing trailingControls slot", () => {
      const onShowUpload = vi.fn();
      renderBar({
        trailingControls: (
          <button
            type="button"
            className="working-mode-show-upload"
            aria-label="Show upload panel"
            onClick={onShowUpload}
          >
            Uploads
          </button>
        ),
      });

      const reopen = screen.getByRole("button", { name: "Show upload panel" });
      expect(reopen).toBeInTheDocument();
      fireEvent.click(reopen);
      expect(onShowUpload).toHaveBeenCalledTimes(1);
    });

    it("desktop variant without trailing controls is byte-identical to today (no upload affordance, no new prop)", () => {
      renderBar({ variant: "desktop" });

      // No trailing-controls wrapper renders when nothing is passed, so the
      // desktop bar is unchanged. Reusing trailingControls (not a new
      // uploadToggle prop) makes this trivially true.
      expect(
        document.querySelector(".working-mode-trailing-controls"),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Show upload panel" }),
      ).not.toBeInTheDocument();
      // Open + New are the only action buttons (plus the logo).
      expect(
        screen.getByRole("button", { name: "Open" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    });

    it("hides the hosted-phone collapse rail only in working mode so it is never the sole inert reopen path (F5)", () => {
      // CSS guard: the rail is hidden under .page.is-working-mode (where the
      // working-mode bar is live), NOT unconditionally — preventing a
      // collapsed + non-working-mode dead-end where the inert bar would be the
      // only reopen path.
      const styles = readFileSync(globalCssPath, "utf8");
      // There are multiple rules for this selector (tablet styling + the phone
      // hide); assert at least one body contains display:none. The rule is
      // scoped to .page.is-working-mode, never the bare .collapse-rail, so the
      // dead-end F5 warns about cannot occur.
      const matches = [
        ...styles.matchAll(
          /\.app-shell-hosted \.page\.is-working-mode \.collapse-rail\s*\{([^}]*)\}/g,
        ),
      ].map((match) => match[1]);
      expect(matches.some((body) => body.includes("display: none;"))).toBe(true);
      // Guard against an over-broad hide that would also kill the rail outside
      // working mode (the F5 dead-end).
      expect(styles).not.toContain(
        ".app-shell-hosted .collapse-rail {\n    display: none;",
      );
    });
  });
});

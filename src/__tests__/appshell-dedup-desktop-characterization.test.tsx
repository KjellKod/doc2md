// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
//
// AppShell dedup Phase 2 — desktop characterization spec.
//
// Harness decision: vitest+RTL+installMockShell under jsdom. The byte-identical
// geometry assertion for the desktop variant is explicitly downgraded to
// "computed-style equivalence under jsdom + installMockShell" because the
// current Playwright config does not serve `vite --mode desktop`. We assert
// the same inline style attributes and CSS variable strings the hosted web
// characterization spec asserts via Playwright. See
// .quest/appshell-dedup-phase-2_2026-05-16__1614/phase_02_implementation/
// builder_feedback_discussion.md (Harness Decision Rationale) for the full
// rationale.

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DesktopApp from "../desktop/DesktopApp";
import { installMockShell } from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

// Baseline snapshot constants. Asserted byte-identical against the same
// constants used by the hosted web characterization spec at
// tests/e2e/appshell-dedup-characterization.spec.ts.
const BASELINE_PAGE_MAX_WIDTH_PX = "1680px";
const BASELINE_DEFAULT_SIDEBAR_WIDTH_PX = "430px";

afterEach(() => {
  delete window.doc2mdShell;
  cleanup();
});

describe("AppShell dedup characterization (desktop)", () => {
  it("page-frame --page-max-width inline style is byte-identical to web baseline", () => {
    render(<DesktopApp />);
    const pageFrame = document.querySelector(".page-frame");
    expect(pageFrame).not.toBeNull();
    expect(pageFrame!.getAttribute("style")).toBe(
      `--page-max-width: ${BASELINE_PAGE_MAX_WIDTH_PX};`,
    );
  });

  it("workspace --sidebar-width inline style default is byte-identical to web baseline", () => {
    render(<DesktopApp />);
    const workspace = document.querySelector(".workspace");
    expect(workspace).not.toBeNull();
    expect(workspace!.getAttribute("style")).toBe(
      `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
    );
  });

  it("preview-panel inline style includes well-formed --preview-panel-ceiling at idle", () => {
    render(<DesktopApp />);
    const previewPanel = document.querySelector(".preview-panel");
    expect(previewPanel).not.toBeNull();
    const idleStyle = previewPanel!.getAttribute("style") ?? "";
    expect(idleStyle).toMatch(/^--preview-panel-ceiling: \d+px;$/);
  });

  it("body resize class is absent when idle", () => {
    render(<DesktopApp />);
    expect(document.body.classList.contains("is-sidebar-resizing")).toBe(false);
    expect(document.body.classList.contains("is-height-resizing")).toBe(false);
  });

  it("renders the view switcher with byte-identical landing meta string", () => {
    render(<DesktopApp />);
    expect(screen.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Install & Use" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      document.querySelector(".view-switcher-meta")?.textContent,
    ).toBe("Start from scratch or with single and mixed-format batches");
  });

  it("renders DesktopMenuBridge only when window.doc2mdShell is present", () => {
    const cleanupShell = installMockShell();
    render(<DesktopApp />);
    expect(screen.getByTestId("desktop-menu-bridge")).toBeInTheDocument();
    cleanupShell();
  });

  it("collapses the upload sidebar on first non-scratch entry open", async () => {
    const cleanupShell = installMockShell({
      openFile: async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/mock/Alpha.md",
        content: "# Alpha",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      }),
    });

    render(<DesktopApp />);
    // Trigger the open path via the native-menu open event, mirroring how
    // App.desktop.test.tsx already exercises the open flow.
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    // After the first non-scratch open, the auto-collapse one-shot must fire.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Show upload panel" }),
      ).toBeInTheDocument();
    });

    cleanupShell();
  });
});

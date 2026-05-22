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
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesktopApp from "../desktop/DesktopApp";
import {
  createMockImportShellFile,
  installMockShell,
} from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

// Baseline snapshot constants. Asserted byte-identical against the same
// constants used by the hosted web characterization spec at
// tests/e2e/appshell-dedup-characterization.spec.ts.
const BASELINE_PAGE_MAX_WIDTH_PX = "1680px";
const BASELINE_DEFAULT_SIDEBAR_WIDTH_PX = "380px";
const BASELINE_MIN_EDIT_SHELL_HEIGHT = 240;

afterEach(() => {
  delete window.doc2mdShell;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  cleanup();
});

vi.mock("../converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

function createSuccessResult(markdown: string) {
  return {
    markdown,
    warnings: [],
    status: "success" as const,
  };
}

function mockDoc2mdProtocol() {
  vi.stubGlobal("location", {
    ...window.location,
    protocol: "doc2md:",
  });
}

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

  it("sidebar width and editor height styles round-trip through desktop resize controls", async () => {
    const cleanupShell = installMockShell({
      openFile: async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/mock/Geometry.md",
        content: "# Geometry",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      }),
    });

    render(<DesktopApp />);
    const workspace = document.querySelector(".workspace");
    expect(workspace).not.toBeNull();
    expect(workspace!.getAttribute("style")).toBe(
      `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
    );

    const splitBar = screen.getByRole("separator", {
      name: "Resize upload panel",
    });
    fireEvent.keyDown(splitBar, { key: "ArrowLeft" });
    expect(workspace!.getAttribute("style")).toMatch(/^--sidebar-width: \d+px;$/);
    expect(workspace!.getAttribute("style")).not.toBe(
      `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
    );
    fireEvent.keyDown(splitBar, { key: "Home" });
    expect(workspace!.getAttribute("style")).toBe(
      `--sidebar-width: ${BASELINE_DEFAULT_SIDEBAR_WIDTH_PX};`,
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Geometry" });

    const previewPanel = document.querySelector(".preview-panel");
    expect(previewPanel).not.toBeNull();
    const heightHandle = screen.getByRole("separator", {
      name: "Resize editor height",
    });
    fireEvent.keyDown(heightHandle, { key: "ArrowDown" });
    const resizedStyle = previewPanel!.getAttribute("style") ?? "";
    expect(resizedStyle).toMatch(
      /^--preview-panel-ceiling: \d+px; height: \d+px; min-height: \d+px;$/,
    );
    const heightMatch = resizedStyle.match(/ height: (\d+)px;/);
    expect(heightMatch).not.toBeNull();
    expect(Number(heightMatch![1])).toBeGreaterThanOrEqual(
      BASELINE_MIN_EDIT_SHELL_HEIGHT,
    );

    fireEvent.keyDown(heightHandle, { key: "Home" });
    expect(previewPanel!.getAttribute("style")).toMatch(
      /^--preview-panel-ceiling: \d+px;$/,
    );

    cleanupShell();
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

  it("updates desktop view switcher meta from the same source state as the shell", async () => {
    const cleanupShell = installMockShell({
      openFile: async () => ({
        ok: true as const,
        kind: "markdown" as const,
        path: "/mock/Meta.md",
        content: "# Meta",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      }),
    });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Meta" });

    expect(document.querySelector(".view-switcher-meta")?.textContent).toBe(
      "1 converted file",
    );
    expect(document.querySelector("#view-tab-convert")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    cleanupShell();
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

  it("auto-collapse is one-shot after manual desktop re-expand", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/mock/First.md",
        content: "# First",
        mtimeMs: 10,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        kind: "markdown" as const,
        path: "/mock/Second.md",
        content: "# Second",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "First" });
    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("heading", { name: "Second" });

    expect(
      screen.queryByRole("button", { name: "Show upload panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open First.md" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Second.md" }),
    ).toBeInTheDocument();

    cleanupShell();
  });

  it("desktop drop-zone browse uses shell.openFile and mounts PreviewPanel with desktop save props", async () => {
    const openFile = vi.fn(async () => ({
      ok: true as const,
      kind: "markdown" as const,
      path: "/mock/Browse.md",
      content: "# Browse",
      mtimeMs: 10,
      lineEnding: "lf" as const,
    }));
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "browse from your device",
      }),
    );

    await screen.findByRole("heading", { name: "Browse" });
    expect(openFile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Edit markdown" })).toHaveValue(
      "# Browse",
    );
    expect(screen.getByRole("button", { name: "Save document" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Meta+S",
    );

    cleanupShell();
  });

  it("desktop drop-zone browse routes native import handoffs through conversion", async () => {
    mockDoc2mdProtocol();
    convertFileMock.mockResolvedValue(createSuccessResult("# Imported"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["hello world"], { type: "text/plain" }), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const openFile = vi.fn(async () =>
      createMockImportShellFile({
        path: "/mock/sample.txt",
        name: "sample.txt",
        mtimeMs: 10,
      }),
    );
    const cleanupShell = installMockShell({ openFile });

    render(<DesktopApp />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "browse from your device",
      }),
    );

    await waitFor(() =>
      expect(convertFileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "sample.txt",
          type: "text/plain",
          lastModified: 10,
        }),
      ),
    );
    const showUploadPanel = screen.queryByRole("button", {
      name: "Show upload panel",
    });
    if (showUploadPanel) {
      fireEvent.click(showUploadPanel);
    }
    expect(
      await screen.findByRole("button", { name: /Open sample\.md/i }),
    ).toBeInTheDocument();
    expect(openFile).toHaveBeenCalledTimes(1);

    cleanupShell();
  });
});

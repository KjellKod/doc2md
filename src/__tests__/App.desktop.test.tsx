import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { installMockShell } from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

vi.mock("../converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

describe("App desktop bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete window.doc2mdShell;
    cleanup();
  });

  it("renders no desktop-only DOM when window.doc2mdShell is absent", () => {
    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
  });

  it("gates desktop-only DOM when the shell version is incompatible", () => {
    const cleanupShell = installMockShell({ version: 2 });

    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();

    cleanupShell();
  });

  it("routes native New through the same scratch-entry action as the app UI", async () => {
    const cleanupShell = installMockShell();

    render(<App />);

    expect(screen.getByTestId("desktop-menu-bridge")).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(
      await screen.findByRole("button", { name: /untitled\.md/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 draft")).toBeInTheDocument();

    cleanupShell();
  });
});

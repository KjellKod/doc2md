import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDesktopCapability } from "../useDesktopCapability";
import { installMockShell } from "../mockShellBridge";

function CapabilityProbe() {
  const { isDesktop, shell } = useDesktopCapability();

  return (
    <output data-testid="desktop-capability">
      {isDesktop && shell ? "desktop" : "browser"}
    </output>
  );
}

describe("useDesktopCapability", () => {
  afterEach(() => {
    delete window.doc2mdShell;
    cleanup();
  });

  it("reports browser mode when the shell is absent", () => {
    render(<CapabilityProbe />);

    expect(screen.getByTestId("desktop-capability")).toHaveTextContent(
      "browser",
    );
  });

  it("reports desktop mode when a version 1 shell is installed", () => {
    const cleanupShell = installMockShell();

    render(<CapabilityProbe />);

    expect(screen.getByTestId("desktop-capability")).toHaveTextContent(
      "desktop",
    );

    cleanupShell();
  });

  it("version-gates incompatible shells", () => {
    const cleanupShell = installMockShell({ version: 2 });

    render(<CapabilityProbe />);

    expect(screen.getByTestId("desktop-capability")).toHaveTextContent(
      "browser",
    );

    cleanupShell();
  });
});

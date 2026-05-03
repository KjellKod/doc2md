import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SaveState } from "../../types/saveState";
import SaveStatePill from "../SaveStatePill";

describe("SaveStatePill", () => {
  afterEach(() => {
    cleanup();
  });

  it.each<[SaveState, string]>([
    ["saved", "Saved"],
    ["edited", "Edited"],
    ["saving", "Saving"],
    ["conflict", "Conflict"],
    ["error", "Error"],
    ["permission-needed", "Permission needed"],
  ])("renders %s as %s", (state, label) => {
    render(<SaveStatePill state={state} />);

    const pill = screen.getByRole("status");

    expect(pill).toHaveTextContent(label);
    expect(pill).toHaveClass(`save-state-pill--${state}`);
    expect(pill).toHaveAttribute("aria-live", "polite");
    expect(pill).toHaveAttribute("aria-atomic", "true");
  });
});

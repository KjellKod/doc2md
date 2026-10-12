import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaveState } from "../../types/saveState";
import SaveStatePill from "../SaveStatePill";

describe("SaveStatePill", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("only schedules relative updates when the displayed status includes time", () => {
    vi.useFakeTimers();
    const lastSavedAt = Date.now();
    const { rerender } = render(<SaveStatePill state="saved" lastSavedAt={lastSavedAt} outputMode="download" compact />);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByRole("status")).toHaveAttribute("data-output-mode", "download");
    rerender(<SaveStatePill state="saved" lastSavedAt={lastSavedAt} outputMode="save" compact />);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toHaveTextContent("2s ago");
    rerender(<SaveStatePill state="saved" lastSavedAt={lastSavedAt} outputMode="download" compact />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each<[SaveState, number | null, string]>([
    ["saved", null, "Ready to download"],
    ["saved", Date.now(), "Download started"],
    ["edited", null, "Not downloaded"],
    ["saving", null, "Preparing download"],
  ])("describes browser output honestly for %s", (state, lastSavedAt, label) => {
    render(<SaveStatePill state={state} lastSavedAt={lastSavedAt} outputMode="download" />);
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.getByRole("status")).not.toHaveTextContent(/saved|saving/i);
  });

  it.each<[SaveState, string]>([
    ["saved", "Saved"],
    ["edited", "Unsaved"],
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

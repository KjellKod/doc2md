import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaveButton from "../SaveButton";

describe("SaveButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with an accessible save label", () => {
    render(<SaveButton onSave={() => undefined} />);

    expect(
      screen.getByRole("button", { name: "Save document" }),
    ).toBeInTheDocument();
  });

  it("fires onSave when clicked", () => {
    const onSave = vi.fn();

    render(<SaveButton onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not fire onSave while disabled", () => {
    const onSave = vi.fn();

    render(<SaveButton onSave={onSave} disabled />);
    const button = screen.getByRole("button", { name: "Save document" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("is focusable and exposes busy state", () => {
    render(<SaveButton onSave={() => undefined} busy />);
    const button = screen.getByRole("button", { name: "Save document" });

    button.focus();

    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AboutDialog from "./AboutDialog";

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
  });
});
afterEach(() => {
  cleanup();
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  }
});

describe("AboutDialog", () => {
  it("opens a named native modal with safe external resource links", () => {
    const showModal = vi.mocked(HTMLDialogElement.prototype.showModal);
    render(<AboutDialog onClose={vi.fn()} />);
    expect(showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "About doc2md" })).toHaveAccessibleDescription(
      "Convert documents to Markdown, privately on your device. Review, edit, and export your work in one place.",
    );
    expect(screen.getByRole("button", { name: "Close" }).closest("form"))
      .toHaveAttribute("method", "dialog");
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("notifies the owner when the native modal closes", () => {
    const onClose = vi.fn();
    render(<AboutDialog onClose={onClose} />);
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

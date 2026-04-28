import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FindReplaceBar from "../FindReplaceBar";

function ControlledFindReplaceBar({
  initialSource = "Alpha beta alpha",
  showReplace = false,
  onClose = vi.fn(),
}: {
  initialSource?: string;
  showReplace?: boolean;
  onClose?: () => void;
}) {
  const [source, setSource] = useState(initialSource);
  const [replaceVisible, setReplaceVisible] = useState(showReplace);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <>
      <textarea ref={textareaRef} value={source} readOnly aria-label="source" />
      <FindReplaceBar
        source={source}
        onSourceChange={setSource}
        textareaRef={textareaRef}
        onClose={onClose}
        showReplace={replaceVisible}
        onShowReplaceChange={setReplaceVisible}
        focusRequest={{ id: 0, target: showReplace ? "replace" : "find" }}
        onActiveMatchChange={vi.fn()}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
});

describe("FindReplaceBar", () => {
  it("shows match count and supports next and previous navigation", () => {
    render(<ControlledFindReplaceBar />);

    const findInput = screen.getByRole("textbox", {
      name: "Find markdown text",
    });

    fireEvent.change(findInput, { target: { value: "alpha" } });

    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(findInput, { key: "Enter", shiftKey: true });
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(document.activeElement).toBe(findInput);
  });

  it("shows zero-match and invalid-regex states accessibly", () => {
    render(<ControlledFindReplaceBar />);

    const findInput = screen.getByRole("textbox", {
      name: "Find markdown text",
    });

    fireEvent.change(findInput, { target: { value: "missing" } });
    expect(screen.getByText("0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Regex search" }));
    fireEvent.change(findInput, { target: { value: "[" } });

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid regex");
    expect(findInput).toHaveAttribute("aria-invalid", "true");
  });

  it("replaces current and all matches through the source change path", () => {
    render(<ControlledFindReplaceBar showReplace />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "alpha" },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Replacement text" }), {
      target: { value: "gamma" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.getByRole("textbox", { name: "source" })).toHaveValue(
      "gamma beta alpha",
    );

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByRole("textbox", { name: "source" })).toHaveValue(
      "gamma beta gamma",
    );
    expect(screen.getByText("Replaced 1")).toBeInTheDocument();
  });

  it("announces replace-all status", () => {
    render(<ControlledFindReplaceBar showReplace />);

    fireEvent.change(
      screen.getByRole("textbox", { name: "Find markdown text" }),
      {
        target: { value: "alpha" },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Replacement text" }), {
      target: { value: "gamma" },
    });

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(screen.getByText("Replaced 2")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();

    render(<ControlledFindReplaceBar onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("search"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

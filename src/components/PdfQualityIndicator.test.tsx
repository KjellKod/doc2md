import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversionQuality } from "../converters/types";
import PdfQualityIndicator from "./PdfQualityIndicator";

function renderIndicator(quality: ConversionQuality) {
  render(<PdfQualityIndicator quality={quality} />);
}

afterEach(() => {
  cleanup();
});

describe("PdfQualityIndicator", () => {
  it("renders a good indicator with the correct accessible label", () => {
    renderIndicator({
      level: "good",
      summary: "Good: Selectable text detected. Layout looks straightforward.",
    });

    expect(
      screen.getByRole("button", { name: "PDF quality: Good" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Good")).not.toBeInTheDocument();
  });

  it("renders a review indicator with visible label text", () => {
    renderIndicator({
      level: "review",
      summary:
        "Review: Text was extracted, but layout may be fragmented or out of reading order.",
    });

    expect(
      screen.getByRole("button", { name: "PDF quality: Review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("renders a poor indicator with visible label text", () => {
    renderIndicator({
      level: "poor",
      summary:
        "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
    });

    expect(
      screen.getByRole("button", { name: "PDF quality: Poor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
  });

  it("shows the tooltip with exact copy on keyboard focus", () => {
    renderIndicator({
      level: "review",
      summary:
        "Review: Text was extracted, but layout may be fragmented or out of reading order.",
    });

    const trigger = screen.getByRole("button", { name: "PDF quality: Review" });
    fireEvent.focus(trigger);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Review: Text was extracted, but layout may be fragmented or out of reading order.",
    );
  });

  it("shows the tooltip when clicked for touch-style interaction", () => {
    renderIndicator({
      level: "poor",
      summary:
        "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
    });

    fireEvent.click(screen.getByRole("button", { name: "PDF quality: Poor" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Poor: Little or no selectable text detected. This PDF may be scanned or image-based.",
    );
  });
});

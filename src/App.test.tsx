import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the core product promise", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Document to Markdown, without leaving the browser."
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Private by design: your files never leave your browser")
    ).toBeInTheDocument();
  });
});

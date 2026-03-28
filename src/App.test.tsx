import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "doc2md — Document to Markdown" })
    ).toBeInTheDocument();
  });
});

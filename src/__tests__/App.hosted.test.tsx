import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

vi.mock("../converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

describe("App hosted save control", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.doc2mdShell;
    cleanup();
  });

  it("downloads through the hosted path and returns the pill to Saved", async () => {
    const createObjectURL = vi.fn(() => "blob:doc2md-test");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    fireEvent.change(await screen.findByLabelText("Edit markdown"), {
      target: { value: "# Hosted\n\nSaved from the browser." },
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Edited"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save document" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("keeps hosted Save disabled for empty scratch drafts", async () => {
    const createObjectURL = vi.fn(() => "blob:doc2md-empty");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    const saveButton = await screen.findByRole("button", {
      name: "Save document",
    });

    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("adds hosted New from a dirty scratch without discarding the draft", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    fireEvent.change(await screen.findByLabelText("Edit markdown"), {
      target: { value: "# Keep me" },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Edited"),
    );

    fireEvent.click(screen.getByRole("button", { name: "New document" }));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(editor).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getAllByText("Keep me").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Untitled 2.md").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /keep me/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Edit markdown")).toHaveValue("# Keep me");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Edited"),
    );
  });

  it("focuses a blank saved editor for hosted New from a dirty scratch", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    fireEvent.change(await screen.findByLabelText("Edit markdown"), {
      target: { value: "# Discard me" },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Edited"),
    );

    fireEvent.click(screen.getByRole("button", { name: "New document" }));

    const editor = await screen.findByLabelText("Edit markdown");
    await waitFor(() => expect(document.activeElement).toBe(editor));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(editor).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });
});

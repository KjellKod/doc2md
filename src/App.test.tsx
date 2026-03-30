import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn()
}));

vi.mock("./converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) => fileName.split(".").pop()?.toLowerCase() ?? ""
}));

function createSuccessResult(markdown: string) {
  return {
    markdown,
    warnings: [],
    status: "success" as const
  };
}

function createFile(name: string) {
  return new File(["content"], name, { type: "text/plain" });
}

describe("App", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

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

  it("renders the current empty upload, file-list, and preview states", () => {
    render(<App />);

    expect(screen.getByText("Drop files to convert")).toBeInTheDocument();
    expect(screen.getByText("No files yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Drop files to convert.")).toHaveLength(2);
    expect(
      screen.getByText("Converted Markdown will render here once a file is ready for review.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download selected" })
    ).toBeDisabled();
  });

  it("supports upload, selection, preview readiness, and download state changes", async () => {
    const pendingResolvers = new Map<string, (value: ReturnType<typeof createSuccessResult>) => void>();

    convertFileMock.mockImplementation(
      (file: File) =>
        new Promise((resolve) => {
          pendingResolvers.set(file.name, resolve);
        })
    );

    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');

    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [createFile("alpha.txt"), createFile("beta.txt")]
      }
    });

    expect(await screen.findByRole("button", { name: /alpha\.txt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta\.txt/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Converting locally.");
    expect(screen.getByRole("button", { name: "Download selected" })).toBeDisabled();

    await act(async () => {
      pendingResolvers.get("alpha.txt")?.(createSuccessResult("# Alpha"));
      pendingResolvers.get("beta.txt")?.(createSuccessResult("# Beta"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download selected" })
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /beta\.txt/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });
  });
});

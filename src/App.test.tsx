import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

vi.mock("./converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

function createSuccessResult(markdown: string) {
  return {
    markdown,
    warnings: [],
    status: "success" as const,
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
        name: "Edit or convert to Markdown, without leaving the browser.",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Private by design: your files never leave your browser",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to day mode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /see how to use @doc2md\/core in node, scripts, mcp-style tools, or a portable skill\./i,
      }),
    ).toHaveAttribute(
      "href",
      "https://github.com/KjellKod/doc2md/blob/main/docs/using-doc2md-core.md",
    );
    expect(
      screen.getByText((_, element) => {
        return (
          element?.textContent ===
          "Is doc2md useful? Sponsor new features and bug fixes."
        );
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sponsor new features and bug fixes." }),
    ).toHaveAttribute("href", "https://github.com/sponsors/KjellKod");
  });

  it("renders the current empty upload, file-list, and preview states", () => {
    render(<App />);

    expect(
      screen.getByText("Drop files or start writing."),
    ).toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Start with writing or drop a file."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start writing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Open the editor to paste or write Markdown from scratch, or convert a document and review the result here.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download selected" }),
    ).toBeDisabled();
  });

  it("supports editor-first scratch drafts without uploads", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));

    expect(
      await screen.findByRole("button", { name: /untitled\.md/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Edit markdown" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download selected" }),
    ).toBeDisabled();
    expect(screen.getByText("1 draft")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
      target: { value: "# Planning Notes\n\nBody" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /planning notes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Draft is ready to preview and download."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download selected" }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(
      screen.getByRole("heading", { name: "Planning Notes" }),
    ).toBeInTheDocument();
  });

  it("collapses and expands the upload sidebar", () => {
    const { container } = render(<App />);
    const workspace = container.querySelector(".workspace");

    expect(workspace).not.toHaveClass("sidebar-collapsed");

    fireEvent.click(
      screen.getByRole("button", { name: "Hide upload panel" }),
    );

    expect(workspace).toHaveClass("sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide upload panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show upload panel" }),
    );

    expect(workspace).not.toHaveClass("sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "Hide upload panel" }),
    ).toBeInTheDocument();
  });

  it("lets desktop users drag the workspace wider from the right edge", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 2600,
    });

    const { container } = render(<App />);
    const pageFrame = container.querySelector(".page-frame");
    const handle = screen.getByRole("button", {
      name: "Resize workspace width",
    });

    expect(pageFrame).toHaveStyle("--page-max-width: 1680px");

    fireEvent.mouseDown(handle, { clientX: 2000 });
    fireEvent.mouseMove(window, { clientX: 2160 });
    fireEvent.mouseUp(window);

    expect(pageFrame).toHaveStyle("--page-max-width: 1840px");

    fireEvent.mouseDown(handle, { clientX: 2160 });
    fireEvent.mouseMove(window, { clientX: 2000 });
    fireEvent.mouseUp(window);

    expect(pageFrame).toHaveStyle("--page-max-width: 1680px");

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it("supports upload, selection, preview readiness, and download state changes", async () => {
    const pendingResolvers = new Map<
      string,
      (value: ReturnType<typeof createSuccessResult>) => void
    >();

    convertFileMock.mockImplementation(
      (file: File) =>
        new Promise((resolve) => {
          pendingResolvers.set(file.name, resolve);
        }),
    );

    const { container } = render(<App />);
    const input = container.querySelector('input[type="file"]');

    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: {
        files: [createFile("alpha.txt"), createFile("beta.txt")],
      },
    });

    expect(
      await screen.findByRole("button", { name: /alpha\.txt/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /beta\.txt/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Converting locally.");
    expect(
      screen.getByRole("button", { name: "Download selected" }),
    ).toBeDisabled();

    await act(async () => {
      pendingResolvers.get("alpha.txt")?.(createSuccessResult("# Alpha"));
      pendingResolvers.get("beta.txt")?.(createSuccessResult("# Beta"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Alpha" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download selected" }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /beta\.txt/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });
  });

  it("toggles between day and night mode", () => {
    render(<App />);

    const toggle = screen.getByRole("button", { name: "Switch to day mode" });

    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(toggle);

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Switch to night mode" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to night mode" }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to day mode" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

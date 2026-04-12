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
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
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
      screen.getByText("Browser-side conversion with no doc2md upload backend"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to day mode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /@doc2md\/core/i,
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

  it("imports a remote document URL through the browser path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-disposition": 'attachment; filename="remote-brief.txt"',
        }),
        blob: vi.fn().mockResolvedValue(new Blob(["remote"], { type: "text/plain" })),
      }),
    );
    convertFileMock.mockResolvedValue(createSuccessResult("# Remote Brief"));

    render(<App />);

    fireEvent.change(screen.getByLabelText("Document URL"), {
      target: { value: "https://example.com/download?brief=1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import URL" }));

    expect(
      await screen.findByRole("button", { name: /remote-brief\.txt/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Remote Brief" }),
      ).toBeInTheDocument();
    });
  });

  it("shows URL import failures inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    render(<App />);

    fireEvent.change(screen.getByLabelText("Document URL"), {
      target: { value: "https://example.com/private.docx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import URL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't download that document in the browser. The site may block direct access or require sign-in.",
    );
  });

  it("shows auth-gated URL import responses inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        blob: vi.fn(),
      }),
    );

    render(<App />);

    fireEvent.change(screen.getByLabelText("Document URL"), {
      target: { value: "https://example.com/private.docx" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import URL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't download that document because the URL requires sign-in or additional access.",
    );
  });

  it("shows URL import timeouts inline", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }));

      render(<App />);

      fireEvent.change(screen.getByLabelText("Document URL"), {
        target: { value: "https://example.com/slow.docx" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Import URL" }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Downloading that document URL timed out. Try again or download it locally first.",
      );
    } finally {
      vi.useRealTimers();
    }
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

  it("switches to the install view and shows the latest tarball link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        filename: "doc2md-core-0.6.3.tgz",
        version: "0.6.3",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Install & Use" }));

    expect(
      await screen.findByRole("heading", {
        name: "Install doc2md for CLI, automation, and agent workflows",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/latest-tarball\.json$/),
      {
        cache: "no-store",
      },
    );
    expect(
      await screen.findByRole("link", { name: /Download tarball/i }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/doc2md-core-0\.6\.3\.tgz$/),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Convert" }));

    expect(screen.getByText("Drop files or start writing.")).toBeInTheDocument();
  });

  it("keeps both tab panels mounted and hides the inactive one", () => {
    const { container } = render(<App />);

    const convertPanel = container.querySelector("#view-panel-convert");
    const installPanel = container.querySelector("#view-panel-install");

    expect(convertPanel).toBeVisible();
    expect(installPanel).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "Install & Use" }));

    expect(container.querySelector("#view-panel-convert")).toHaveAttribute("hidden");
    expect(
      screen.getByRole("tabpanel", { name: "Install & Use" }),
    ).toBeVisible();
  });

  it("switches tabs with arrow keys and moves focus to the active tab", () => {
    render(<App />);

    const convertTab = screen.getByRole("tab", { name: "Convert" });
    const installTab = screen.getByRole("tab", { name: "Install & Use" });

    convertTab.focus();
    fireEvent.keyDown(convertTab, { key: "ArrowRight" });

    expect(installTab).toHaveFocus();
    expect(installTab).toHaveAttribute("aria-selected", "true");
    expect(convertTab).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(installTab, { key: "ArrowLeft" });

    expect(convertTab).toHaveFocus();
    expect(convertTab).toHaveAttribute("aria-selected", "true");
    expect(installTab).toHaveAttribute("tabindex", "-1");
  });
});

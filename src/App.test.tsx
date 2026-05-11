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
import App, { computeEditShellCeiling } from "./App";

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

async function uploadConvertedFiles(container: HTMLElement, names: string[]) {
  convertFileMock.mockImplementation((file: File) =>
    Promise.resolve(createSuccessResult(`# ${file.name.replace(/\.[^.]+$/u, "")}`)),
  );

  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();

  fireEvent.change(input!, {
    target: {
      files: names.map(createFile),
    },
  });

  for (const name of names) {
    expect(
      await screen.findByRole("button", { name: `Open ${name}` }),
    ).toBeInTheDocument();
  }
}

describe("App", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
      screen.getByText(/Browser only, privacy first\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to day mode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Current release version").textContent,
    ).toMatch(/^\d+\.\d+\.\d+(?:-dev)?$/);
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
        /Open the editor to paste or write Markdown from scratch/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download active file" }),
    ).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "Download active file" }),
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
        screen.getByRole("button", { name: "Download active file" }),
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

  it("lets users drag and keyboard-step the upload panel split bar", () => {
    const { container } = render(<App />);
    const pageFrame = container.querySelector(".page-frame");
    const workspace = container.querySelector<HTMLElement>(".workspace");
    const sidebar = container.querySelector<HTMLElement>(".sidebar-panel");
    const splitBar = screen.getByRole("separator", {
      name: "Resize upload panel",
    });

    expect(pageFrame).not.toBeNull();
    expect(workspace).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(splitBar).toHaveAttribute("aria-orientation", "vertical");
    expect(pageFrame).toHaveStyle("--page-max-width: 1680px");

    Object.defineProperty(sidebar!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 430, 600),
    });

    const getSidebarWidth = () =>
      Number(workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""));

    expect(getSidebarWidth()).toBe(430);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);

    expect(pageFrame).toHaveStyle("--page-max-width: 1680px");
    expect(getSidebarWidth()).toBe(310);

    fireEvent.mouseDown(splitBar, { clientX: 80 });
    fireEvent.mouseMove(window, { clientX: 140 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(370);

    fireEvent.keyDown(splitBar, { key: "ArrowRight" });
    expect(getSidebarWidth()).toBe(386);

    fireEvent.keyDown(splitBar, { key: "ArrowLeft" });
    expect(getSidebarWidth()).toBe(370);

    fireEvent.keyDown(splitBar, { key: "Home" });
    expect(getSidebarWidth()).toBe(430);
  });

  it("resets and snap-collapses the upload panel from the split bar", () => {
    const { container } = render(<App />);
    const workspace = container.querySelector<HTMLElement>(".workspace");
    const sidebar = container.querySelector<HTMLElement>(".sidebar-panel");
    const splitBar = screen.getByRole("separator", {
      name: "Resize upload panel",
    });

    expect(workspace).not.toBeNull();
    expect(sidebar).not.toBeNull();

    Object.defineProperty(sidebar!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 430, 600),
    });

    const getSidebarWidth = () =>
      Number(workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""));

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(310);

    fireEvent.doubleClick(splitBar);
    expect(getSidebarWidth()).toBe(430);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(310);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    expect(workspace).toHaveClass("sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));

    expect(workspace).not.toHaveClass("sidebar-collapsed");
    expect(getSidebarWidth()).toBe(310);
  });

  it("grows the upload panel when dragging the split bar right", () => {
    const { container } = render(<App />);
    const workspace = container.querySelector<HTMLElement>(".workspace");
    const sidebar = container.querySelector<HTMLElement>(".sidebar-panel");
    const splitBar = screen.getByRole("separator", {
      name: "Resize upload panel",
    });

    expect(workspace).not.toBeNull();
    expect(sidebar).not.toBeNull();

    Object.defineProperty(sidebar!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 430, 600),
    });

    const getSidebarWidth = () =>
      Number(workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""));

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(310);

    fireEvent.mouseDown(splitBar, { clientX: 80 });
    fireEvent.mouseMove(window, { clientX: 140 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(370);
  });

  it("lets users grow and reset the editor height with the bottom handle", () => {
    vi.stubGlobal("innerHeight", 1200);
    const { container } = render(<App />);
    const workspace = container.querySelector<HTMLElement>(".workspace");
    const preview = container.querySelector<HTMLElement>(".preview-panel");
    const heightHandle = screen.getByRole("separator", {
      name: "Resize editor height",
    });

    expect(workspace).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(heightHandle).toHaveAttribute("aria-orientation", "horizontal");

    Object.defineProperty(preview!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 280, 900, 700),
    });

    fireEvent.mouseDown(heightHandle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 164 });
    fireEvent.mouseUp(window);

    expect(preview!.style.height).toBe("764px");
    expect(workspace!.style.getPropertyValue("--sidebar-width")).toBe("430px");

    fireEvent.keyDown(heightHandle, { key: "ArrowDown" });
    expect(preview!.style.height).toBe("796px");

    fireEvent.keyDown(heightHandle, { key: "ArrowUp" });
    expect(preview!.style.height).toBe("764px");

    fireEvent.keyDown(heightHandle, { key: "Home" });
    expect(preview!.style.height).toBe("");
  });

  it("does not change editor height until the first horizontal mousemove", () => {
    vi.stubGlobal("innerHeight", 900);
    const { container } = render(<App />);
    const preview = container.querySelector<HTMLElement>(".preview-panel");
    const heightHandle = screen.getByRole("separator", {
      name: "Resize editor height",
    });

    expect(preview).not.toBeNull();

    Object.defineProperty(preview!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 260, 900, 3200),
    });

    fireEvent.mouseDown(heightHandle, { clientY: 100 });

    expect(preview!.style.height).toBe("");
    expect(preview!.style.minHeight).toBe("");

    fireEvent.mouseMove(window, { clientY: 140 });
    fireEvent.mouseUp(window);

    expect(preview!.style.height).not.toBe("");
    expect(preview!.style.minHeight).not.toBe("");
  });

  it("clamps editor height to the viewport-derived ceiling", () => {
    vi.stubGlobal("innerHeight", 1000);
    const previewTop = 260;
    const expected = computeEditShellCeiling(window.innerHeight, previewTop);
    const { container } = render(<App />);
    const preview = container.querySelector<HTMLElement>(".preview-panel");
    const heightHandle = screen.getByRole("separator", {
      name: "Resize editor height",
    });

    expect(preview).not.toBeNull();

    Object.defineProperty(preview!, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, previewTop, 900, 700),
    });

    fireEvent.mouseDown(heightHandle, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 1000 });
    fireEvent.mouseUp(window);

    expect(preview!.style.height).toBe(`${expected}px`);
    expect(preview!.style.maxHeight).toBe("");
    expect(preview!.style.getPropertyValue("--preview-panel-ceiling")).toBe(
      `${expected}px`,
    );
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
      screen.getByRole("button", { name: "Download active file" }),
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
        screen.getByRole("button", { name: "Download active file" }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /beta\.txt/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });
  });

  it("clears checked files first and leaves row checkbox toggles separate from preview activation", async () => {
    const { container } = render(<App />);
    await uploadConvertedFiles(container, ["alpha.txt", "beta.txt", "gamma.txt"]);

    expect(screen.getByRole("heading", { name: "alpha" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select beta.txt" }));

    expect(screen.getByRole("heading", { name: "alpha" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear selected files" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Clear selected files" }));

    expect(
      screen.queryByRole("button", { name: "Open beta.txt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open alpha.txt" })).toHaveClass(
      "is-selected",
    );
    expect(
      screen.getByRole("button", { name: "Clear active file" }),
    ).toBeEnabled();
  });

  it("toggles a file checkbox from the keyboard without changing the active preview", async () => {
    const { container } = render(<App />);
    await uploadConvertedFiles(container, ["alpha.txt", "beta.txt"]);

    const betaCheckbox = screen.getByRole("checkbox", {
      name: "Select beta.txt",
    });
    betaCheckbox.focus();
    fireEvent.keyDown(betaCheckbox, { key: " ", code: "Space" });
    fireEvent.change(betaCheckbox, { target: { checked: true } });

    expect(betaCheckbox).toBeChecked();
    expect(screen.getByRole("heading", { name: "alpha" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open alpha.txt" }),
    ).toHaveClass("is-selected");
    expect(
      screen.getByRole("button", { name: "Open beta.txt" }),
    ).not.toHaveClass("is-selected");
  });

  it("clears the active file when nothing is checked and selects the next file", async () => {
    const { container } = render(<App />);
    await uploadConvertedFiles(container, ["alpha.txt", "beta.txt", "gamma.txt"]);

    fireEvent.click(screen.getByRole("button", { name: "Open beta.txt" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "beta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear active file" }));

    expect(
      screen.queryByRole("button", { name: "Open beta.txt" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "gamma" })).toBeInTheDocument();
    });
  });

  it("clears an edited active draft immediately without confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    await screen.findByRole("button", { name: /untitled\.md/i });
    fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
      target: { value: "# Unsaved draft" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /unsaved draft/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear active file" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /unsaved draft/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
  });

  it("downloads checked files and clears checked state after the action", async () => {
    const clickedDownloads: string[] = [];
    const mockLink = {
      href: "",
      download: "",
      click: vi.fn(() => clickedDownloads.push(mockLink.download)),
      remove: vi.fn(),
    };
    const { container } = render(<App />);
    await uploadConvertedFiles(container, ["alpha.txt", "beta.txt"]);

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue(
      mockLink as unknown as HTMLAnchorElement,
    );
    vi.spyOn(document.body, "append").mockImplementation(
      () => mockLink as unknown as HTMLAnchorElement,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select beta.txt" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Download selected files" }),
    );

    expect(clickedDownloads).toEqual(["beta.md"]);
    expect(screen.getByRole("checkbox", { name: "Select beta.txt" })).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Download active file" }),
    ).toBeEnabled();
  });

  it("select-all reports indeterminate state and toggles all opened files", async () => {
    const { container } = render(<App />);
    await uploadConvertedFiles(container, ["alpha.txt", "beta.txt"]);

    const selectAll = screen.getByRole("checkbox", {
      name: "Select all opened files",
    }) as HTMLInputElement;
    const alpha = screen.getByRole("checkbox", { name: "Select alpha.txt" });
    const beta = screen.getByRole("checkbox", { name: "Select beta.txt" });

    fireEvent.click(alpha);
    expect(selectAll.indeterminate).toBe(true);

    fireEvent.click(selectAll);
    expect(alpha).toBeChecked();
    expect(beta).toBeChecked();
    expect(selectAll.indeterminate).toBe(false);
    expect(selectAll).toBeChecked();

    fireEvent.click(selectAll);
    expect(alpha).not.toBeChecked();
    expect(beta).not.toBeChecked();
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
      "We couldn't fetch that URL in the browser. Try downloading it first or use @doc2md/core.",
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

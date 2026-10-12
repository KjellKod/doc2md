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
import { computeEditShellCeiling } from "./shell/useWorkspaceResize";

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

function changeFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  fireEvent.change(input);
}

async function uploadConvertedFiles(container: HTMLElement, names: string[]) {
  convertFileMock.mockImplementation((file: File) =>
    Promise.resolve(
      createSuccessResult(`# ${file.name.replace(/\.[^.]+$/u, "")}`),
    ),
  );

  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();

  changeFileInput(input!, names.map(createFile));

  // The sidebar auto-collapses on the first non-scratch file open
  // (working-mode polish). Re-expand it so the rest of the test can
  // interact with file-list items.
  await ensureSidebarVisible();

  for (const name of names) {
    expect(
      await screen.findByRole("button", { name: `Open ${name}` }),
    ).toBeInTheDocument();
  }
}

async function ensureSidebarVisible() {
  const showButton = screen.queryByRole("button", {
    name: "Show upload panel",
  });
  if (showButton) {
    fireEvent.click(showButton);
  }
}

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");

// jsdom does not implement native modal activation or focus placement.
function mockNativeDialog() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
      this.querySelector<HTMLButtonElement>("button")?.focus();
    },
  });
}

describe("App", () => {
  afterEach(() => {
    if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
    cleanup();
  });

  it("opens directly into the workspace with preferences and product information in Settings", () => {
    mockNativeDialog();
    render(<App />);
    expect(
      screen.getByRole("button", { name: "doc2md workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("combobox", { name: "Appearance" })).toHaveValue(
      "dark",
    );
    expect(
      screen.getByLabelText("Current release version").textContent,
    ).toMatch(/^\d+\.\d+\.\d+(?:-dev)?$/);
    fireEvent.click(screen.getByRole("button", { name: "About doc2md" }));
    expect(
      screen.getByRole("link", { name: /@doc2md\/core/i }),
    ).toHaveAttribute(
      "href",
      "https://github.com/KjellKod/doc2md/blob/main/docs/using-doc2md-core.md",
    );
    expect(
      screen.getByRole("link", { name: "Sponsor doc2md" }),
    ).toHaveAttribute("href", "https://github.com/sponsors/KjellKod");
  });

  it("renders the current empty upload, file-list, and preview states", () => {
    render(<App />);

    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing to preview yet.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start writing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Start writing or convert a file; the Markdown result will appear here/,
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
      await screen.findByRole("button", { name: "Open Untitled.md" }),
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
        screen.getByRole("button", { name: "Open Planning Notes" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Draft is ready to preview and download."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download active file" }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(
      screen.getByRole("heading", { name: "Planning Notes" }),
    ).toBeInTheDocument();
  });

  it("shows working-mode chrome for a hosted non-scratch entry", async () => {
    const { container } = render(<App />);

    await uploadConvertedFiles(container, ["alpha.txt"]);

    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(
      screen.getByRole("button", { name: "doc2md workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();
  });

  it("opens scratch entries in the working layout", async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));

    expect(
      await screen.findByRole("button", { name: "Open Untitled.md" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "doc2md workspace" }),
    ).toBeInTheDocument();
  });

  it("keeps entries when returning to the workspace and opening another file", async () => {
    const { container } = render(<App />);

    await uploadConvertedFiles(container, ["alpha.txt"]);
    fireEvent.click(screen.getByRole("button", { name: "doc2md workspace" }));

    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(
      screen.getByRole("button", { name: "Open alpha.txt" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Start writing or convert files to Markdown.",
      }),
    ).not.toBeInTheDocument();

    const liftedInput =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
    convertFileMock.mockResolvedValueOnce(createSuccessResult("# Beta"));
    await act(async () => {
      changeFileInput(liftedInput, [createFile("beta.txt")]);
      await Promise.resolve();
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Open beta.txt" }),
    );
    await screen.findByRole("heading", { name: "Beta" });
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    await ensureSidebarVisible();
    expect(
      screen.getByRole("button", { name: "Open alpha.txt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open beta.txt" }),
    ).toBeInTheDocument();
  });

  it("keeps the upload panel expanded after returning to the workspace and opening a second file", async () => {
    convertFileMock.mockImplementation((file: File) =>
      Promise.resolve(
        createSuccessResult(`# ${file.name.replace(/\.[^.]+$/u, "")}`),
      ),
    );
    const { container } = render(<App />);
    let liftedInput =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];

    changeFileInput(liftedInput, [createFile("alpha.txt")]);

    await screen.findByRole("heading", { name: "alpha" });
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "doc2md workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));
    expect(
      screen.getByRole("button", { name: "Hide upload panel" }),
    ).toBeInTheDocument();

    liftedInput =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]')[0];
    await act(async () => {
      changeFileInput(liftedInput, [createFile("beta.txt")]);
      await Promise.resolve();
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Open beta.txt" }),
    );
    await screen.findByRole("heading", { name: "beta" });
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
    expect(
      screen.getByRole("button", { name: "Hide upload panel" }),
    ).toBeInTheDocument();
  });

  it("brand navigation preserves the current working document", async () => {
    const { container } = render(<App />);

    await uploadConvertedFiles(container, ["alpha.txt"]);
    fireEvent.click(screen.getByRole("button", { name: "doc2md workspace" }));
    expect(container.querySelector(".page")).toHaveClass("is-working-mode");

    fireEvent.click(screen.getByRole("button", { name: "doc2md workspace" }));

    expect(container.querySelector(".page")).toHaveClass("is-working-mode");
  });

  it("brand navigation keeps the empty workspace ready for input", () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "doc2md workspace" }));

    expect(container.querySelector(".app-shell")).toHaveClass("app-shell-combined");
  });

  it("collapses and expands the upload sidebar", () => {
    const { container } = render(<App />);
    const workspace = container.querySelector(".workspace");

    expect(workspace).not.toHaveClass("sidebar-collapsed");

    fireEvent.click(screen.getByRole("button", { name: "Hide upload panel" }));

    expect(workspace).toHaveClass("sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide upload panel" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));

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
      value: () => new DOMRect(0, 0, 380, 600),
    });

    const getSidebarWidth = () =>
      Number(
        workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""),
      );

    expect(getSidebarWidth()).toBe(240);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);

    expect(pageFrame).toHaveStyle("--page-max-width: 1680px");
    expect(getSidebarWidth()).toBe(260);

    fireEvent.mouseDown(splitBar, { clientX: 80 });
    fireEvent.mouseMove(window, { clientX: 140 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(320);

    fireEvent.keyDown(splitBar, { key: "ArrowRight" });
    expect(getSidebarWidth()).toBe(336);

    fireEvent.keyDown(splitBar, { key: "ArrowLeft" });
    expect(getSidebarWidth()).toBe(320);

    fireEvent.keyDown(splitBar, { key: "Home" });
    expect(getSidebarWidth()).toBe(240);
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
      value: () => new DOMRect(0, 0, 380, 600),
    });

    const getSidebarWidth = () =>
      Number(
        workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""),
      );

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(260);

    fireEvent.doubleClick(splitBar);
    expect(getSidebarWidth()).toBe(240);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 220 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(260);

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 40 });
    fireEvent.mouseUp(window);

    expect(workspace).toHaveClass("sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "Show upload panel" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show upload panel" }));

    expect(workspace).not.toHaveClass("sidebar-collapsed");
    expect(getSidebarWidth()).toBe(260);
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
      value: () => new DOMRect(0, 0, 380, 600),
    });

    const getSidebarWidth = () =>
      Number(
        workspace!.style.getPropertyValue("--sidebar-width").replace("px", ""),
      );

    fireEvent.mouseDown(splitBar, { clientX: 200 });
    fireEvent.mouseMove(window, { clientX: 80 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(260);

    fireEvent.mouseDown(splitBar, { clientX: 80 });
    fireEvent.mouseMove(window, { clientX: 140 });
    fireEvent.mouseUp(window);
    expect(getSidebarWidth()).toBe(320);
  });

  it("lets users grow and reset the editor height with the bottom handle", () => {
    vi.stubGlobal("innerHeight", 1200);
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
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
    expect(workspace!.style.getPropertyValue("--sidebar-width")).toBe("240px");

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
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
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

  it("hides the preview height handle when no document is loaded", () => {
    render(<App />);

    expect(
      screen.queryByRole("separator", { name: "Resize editor height" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Start writing" }),
    ).toBeInTheDocument();
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

    await ensureSidebarVisible();

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
    await uploadConvertedFiles(container, [
      "alpha.txt",
      "beta.txt",
      "gamma.txt",
    ]);

    expect(screen.getByRole("heading", { name: "alpha" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select beta.txt" }));

    expect(screen.getByRole("heading", { name: "alpha" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear selected files" }),
    ).toBeEnabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear selected files" }),
    );

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
    expect(screen.getByRole("button", { name: "Open alpha.txt" })).toHaveClass(
      "is-selected",
    );
    expect(
      screen.getByRole("button", { name: "Open beta.txt" }),
    ).not.toHaveClass("is-selected");
  });

  it("clears the active file when nothing is checked and selects the next file", async () => {
    const { container } = render(<App />);
    await uploadConvertedFiles(container, [
      "alpha.txt",
      "beta.txt",
      "gamma.txt",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Open beta.txt" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "beta" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear active file" }));

    expect(
      screen.queryByRole("button", { name: "Open beta.txt" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "gamma" }),
      ).toBeInTheDocument();
    });
  });

  it("clears an edited active draft after discard confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    await screen.findByRole("button", { name: "Open Untitled.md" });
    fireEvent.change(screen.getByRole("textbox", { name: "Edit markdown" }), {
      target: { value: "# Unsaved draft" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open Unsaved draft" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear active file" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Open Unsaved draft" }),
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

    await waitFor(() => {
      expect(clickedDownloads).toEqual(["beta.md"]);
      expect(
        screen.getByRole("checkbox", { name: "Select beta.txt" }),
      ).not.toBeChecked();
    });
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

  it("toggles between day and night mode in Settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const appearance = screen.getByRole("combobox", { name: "Appearance" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.change(appearance, { target: { value: "light" } });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(appearance).toHaveValue("light");
    fireEvent.change(appearance, { target: { value: "dark" } });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(appearance).toHaveValue("dark");
  });

  it("opens installation documentation externally without replacing the working draft", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    const editor = screen.getByRole("textbox", { name: "Edit markdown" });
    fireEvent.change(editor, { target: { value: "# Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const link = screen.getByRole("link", { name: "Install & Use" });
    expect(link).toHaveAttribute("href", "https://github.com/KjellKod/doc2md/blob/main/INSTALL.md");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(link);
    expect(editor).toBeVisible();
    expect(editor).toHaveValue("# Keep this draft");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("region", { name: "Install & Use" })).not.toBeInTheDocument();
  });

  it("opens About above the working draft without changing the editor", async () => {
    mockNativeDialog();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start writing" }));
    const editor = screen.getByRole("textbox", { name: "Edit markdown" });
    fireEvent.change(editor, { target: { value: "# Keep this draft" } });
    const gear = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(gear);
    fireEvent.click(screen.getByRole("button", { name: "About doc2md" }));
    const about = screen.getByRole("dialog", { name: "About doc2md" });
    expect(about).toBeVisible();
    await waitFor(() => expect(about.contains(document.activeElement)).toBe(true));
    // Native Escape dismissal is covered in the browser test.
    fireEvent(about, new Event("close"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "About doc2md" })).not.toBeInTheDocument());
    await waitFor(() => expect(gear).toHaveFocus());
    expect(editor).toBeVisible();
    expect(editor).toHaveValue("# Keep this draft");
  });

  it("opens Settings from the keyboard and returns focus with Escape", () => {
    render(<App />);
    const gear = screen.getByRole("button", { name: "Settings" });
    gear.focus();
    fireEvent.click(gear);
    expect(screen.getByRole("combobox", { name: "Appearance" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(gear).toHaveFocus();
    expect(
      screen.queryByRole("dialog", { name: "Settings" }),
    ).not.toBeInTheDocument();
  });
});

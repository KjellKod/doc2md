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
import { installMockShell } from "../desktop/mockShellBridge";
import { NATIVE_MENU_EVENTS } from "../desktop/useNativeMenuEvents";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn(),
}));

vi.mock("../converters", () => ({
  convertFile: convertFileMock,
  getFileExtension: (fileName: string) =>
    fileName.split(".").pop()?.toLowerCase() ?? "",
}));

describe("App desktop bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete window.doc2mdShell;
    cleanup();
  });

  it("renders no desktop-only DOM when window.doc2mdShell is absent", () => {
    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();
  });

  it("gates desktop-only DOM when the shell version is incompatible", () => {
    const cleanupShell = installMockShell({ version: 2 });

    render(<App />);

    expect(screen.queryByTestId("desktop-menu-bridge")).not.toBeInTheDocument();
    expect(screen.getByText("No files or drafts yet.")).toBeInTheDocument();

    cleanupShell();
  });

  it("routes native New through the same scratch-entry action as the app UI", async () => {
    const cleanupShell = installMockShell();

    render(<App />);

    expect(screen.getByTestId("desktop-menu-bridge")).toBeInTheDocument();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));

    expect(
      await screen.findByRole("button", { name: /untitled\.md/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 draft")).toBeInTheDocument();

    cleanupShell();
  });

  it("renders the desktop app-ready marker with visible title and save state", () => {
    const cleanupShell = installMockShell();

    render(<App />);

    expect(screen.getByLabelText("Desktop file status")).toHaveAttribute(
      "data-app-ready",
      "true",
    );
    expect(screen.getByText("Untitled.md")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    cleanupShell();
  });

  it("opens a native Markdown file and saves it with CRLF metadata", async () => {
    const saveFile = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Notes.md",
      mtimeMs: 12,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Notes.md",
        content: "one\r\ntwo\r\n",
        mtimeMs: 10,
        lineEnding: "crlf" as const,
      })),
      saveFile,
    });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));

    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Notes.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit markdown"), {
      target: { value: "one\r\ntwo\r\nthree" },
    });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith({
      path: "/Users/me/Notes.md",
      content: "one\ntwo\nthree",
      expectedMtimeMs: 10,
      lineEnding: "crlf",
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    cleanupShell();
  });

  it("routes scratch saves to Save As and preserves cancellation as edited", async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: false as const,
      code: "cancelled" as const,
    }));
    const cleanupShell = installMockShell({ saveFileAs });

    render(<App />);

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.new));
    await screen.findByRole("button", { name: /untitled\.md/i });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(saveFileAs).toHaveBeenCalledWith({
      suggestedName: "Untitled.md",
      content: "",
      lineEnding: "lf",
    });
    expect(await screen.findByText("Edited")).toBeInTheDocument();

    cleanupShell();
  });

  it("preserves a clean saved document state when Save As is cancelled", async () => {
    const saveFileAs = vi.fn(async () => ({
      ok: false as const,
      code: "cancelled" as const,
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Clean.md",
        content: "clean",
        mtimeMs: 15,
        lineEnding: "lf" as const,
      })),
      saveFileAs,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Clean.md",
      ),
    );
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.saveAs));

    await waitFor(() => expect(saveFileAs).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Saved",
    );

    cleanupShell();
  });

  it("shows conflict actions and retries overwrite with actual mtime", async () => {
    const saveFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Conflict.md",
        actualMtimeMs: 30,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Conflict.md",
        mtimeMs: 31,
      });
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Conflict.md",
        content: "draft",
        mtimeMs: 20,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Conflict.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    expect(await screen.findByText("File changed on disk.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(saveFile).toHaveBeenLastCalledWith({
      path: "/Users/me/Conflict.md",
      content: "draft",
      expectedMtimeMs: 30,
      lineEnding: "lf",
    });

    cleanupShell();
  });

  it("keeps conflict overwrite targeted to the conflicted document after selection changes", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Alpha.md",
        content: "alpha",
        mtimeMs: 100,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Beta.md",
        content: "beta",
        mtimeMs: 200,
        lineEnding: "lf" as const,
      });
    const saveFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Alpha.md",
        actualMtimeMs: 101,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Alpha.md",
        mtimeMs: 102,
      });
    const cleanupShell = installMockShell({ openFile, saveFile });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /alpha\.md/i });
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await screen.findByRole("button", { name: /beta\.md/i });

    fireEvent.click(screen.getByRole("button", { name: /alpha\.md/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Alpha.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");

    fireEvent.click(screen.getByRole("button", { name: /beta\.md/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Beta.md",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(saveFile).toHaveBeenLastCalledWith({
      path: "/Users/me/Alpha.md",
      content: "alpha",
      expectedMtimeMs: 101,
      lineEnding: "lf",
    });
    expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
      "Alpha.md",
    );

    cleanupShell();
  });

  it("reloads a conflicted file through the current-session openFile path", async () => {
    const openFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Reload.md",
        content: "local",
        mtimeMs: 40,
        lineEnding: "lf" as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        path: "/Users/me/Reload.md",
        content: "disk",
        mtimeMs: 41,
        lineEnding: "lf" as const,
      });
    const cleanupShell = installMockShell({
      openFile,
      saveFile: vi.fn(async () => ({
        ok: false as const,
        code: "conflict" as const,
        path: "/Users/me/Reload.md",
        actualMtimeMs: 41,
      })),
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Reload.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    await screen.findByText("File changed on disk.");
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    await waitFor(() =>
      expect(openFile).toHaveBeenLastCalledWith({ path: "/Users/me/Reload.md" }),
    );
    expect(await screen.findByText("disk")).toBeInTheDocument();

    cleanupShell();
  });

  it("guards repeated native save events while a save is pending", async () => {
    let resolveSave: (value: {
      ok: true;
      path: string;
      mtimeMs: number;
    }) => void = () => {};
    const saveFile = vi.fn(
      () =>
        new Promise<{ ok: true; path: string; mtimeMs: number }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Pending.md",
        content: "pending",
        mtimeMs: 50,
        lineEnding: "lf" as const,
      })),
      saveFile,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Pending.md",
      ),
    );

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.save));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    resolveSave({ ok: true, path: "/Users/me/Pending.md", mtimeMs: 51 });
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    cleanupShell();
  });

  it("reveals saved files from the visible control and native menu event", async () => {
    const revealInFinder = vi.fn(async () => ({
      ok: true as const,
      path: "/Users/me/Reveal.md",
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Reveal.md",
        content: "reveal",
        mtimeMs: 60,
        lineEnding: "lf" as const,
      })),
      revealInFinder,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Reveal.md",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    await waitFor(() => expect(revealInFinder).toHaveBeenCalledTimes(2));
    expect(revealInFinder).toHaveBeenCalledWith({ path: "/Users/me/Reveal.md" });
    expect(await screen.findByText("Revealed Reveal.md in Finder.")).toBeInTheDocument();

    cleanupShell();
  });

  it("does not call reveal without a saved path and surfaces reveal failures", async () => {
    const revealInFinder = vi.fn(async () => ({
      ok: false as const,
      code: "permission-needed" as const,
      path: "/Users/me/Denied.md",
      message: "Select the document again.",
    }));
    const cleanupShell = installMockShell({
      openFile: vi.fn(async () => ({
        ok: true as const,
        path: "/Users/me/Denied.md",
        content: "denied",
        mtimeMs: 70,
        lineEnding: "lf" as const,
      })),
      revealInFinder,
    });

    render(<App />);
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    expect(
      await screen.findByText("Save the document before revealing it in Finder."),
    ).toBeInTheDocument();
    expect(revealInFinder).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.open));
    await waitFor(() =>
      expect(screen.getByLabelText("Desktop file status")).toHaveTextContent(
        "Denied.md",
      ),
    );
    window.dispatchEvent(new CustomEvent(NATIVE_MENU_EVENTS.revealInFinder));

    expect(
      await screen.findByText("Permission needed: Select the document again."),
    ).toBeInTheDocument();

    cleanupShell();
  });
});

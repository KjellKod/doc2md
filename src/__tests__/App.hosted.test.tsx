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

const forbiddenHostedNetworkPattern =
  /license\.doc2md\.dev|doc2md\.dev\/buy|checkout/i;

const requestInputToURLString = (input: unknown) => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }
  if (
    input &&
    typeof input === "object" &&
    "url" in input &&
    typeof input.url === "string"
  ) {
    return input.url;
  }
  return String(input);
};

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

  it("does not expose Mac licensing, checkout, browser license storage, or issuer requests", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const xhrOpenSpy = vi
      .spyOn(XMLHttpRequest.prototype, "open")
      .mockImplementation(() => undefined);
    const sendBeaconSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconSpy,
    });
    const localStorageSetItem = vi.spyOn(
      Storage.prototype,
      "setItem",
    );

    render(<App />);

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(
      /\b(License|Buy License|Checkout|doc2md\.dev\/buy|license\.doc2md\.dev)\b/i,
    );
    expect(localStorageSetItem).not.toHaveBeenCalledWith(
      expect.stringMatching(/license/i),
      expect.anything(),
    );
    expect(Object.keys(localStorage)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/license/i)]),
    );
    expect(Object.keys(sessionStorage)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/license/i)]),
    );
    expect(fetchSpy.mock.calls.map(([input]) => requestInputToURLString(input)))
      .not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(forbiddenHostedNetworkPattern),
        ]),
      );
    expect(
      xhrOpenSpy.mock.calls.map(([, url]) => requestInputToURLString(url)),
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(forbiddenHostedNetworkPattern),
      ]),
    );
    expect(
      sendBeaconSpy.mock.calls.map(([url]) => requestInputToURLString(url)),
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(forbiddenHostedNetworkPattern),
      ]),
    );
  });
});

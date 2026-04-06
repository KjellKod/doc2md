import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallPage from "./InstallPage";

describe("InstallPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch the tarball manifest while inactive", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<InstallPage active={false} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the tarball manifest only once across tab re-activation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        filename: "doc2md-core-1.0.1.tgz",
        version: "1.0.1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<InstallPage active />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(<InstallPage active={false} />);
    rerender(<InstallPage active />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows retrying the tarball manifest fetch after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          filename: "doc2md-core-1.0.1.tgz",
          version: "1.0.1",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<InstallPage active />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry manifest fetch" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.getAllByText("Latest Pages artifact:", { exact: false }).length
    ).toBeGreaterThan(0);
  });
});

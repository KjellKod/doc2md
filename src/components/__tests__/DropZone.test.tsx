import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DropZone from "../DropZone";

describe("DropZone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("keeps the browser file input click path wired", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<DropZone onFilesAdded={() => undefined} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /browse from your device/i })[1],
    );

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it("passes selected files through the existing onFilesAdded path", () => {
    const onFilesAdded = vi.fn();
    const { container } = render(<DropZone onFilesAdded={onFilesAdded} />);
    const input = container.querySelector('input[type="file"]');
    const files = [new File(["content"], "sample.txt", { type: "text/plain" })];

    fireEvent.change(input!, { target: { files } });

    expect(onFilesAdded).toHaveBeenCalledWith(files);
  });

  it("routes the browse button through onBrowseRequest when provided and skips the HTML file input", () => {
    const onBrowseRequest = vi.fn();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <DropZone
        onFilesAdded={() => undefined}
        onBrowseRequest={onBrowseRequest}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /browse from your device/i })[1],
    );

    expect(onBrowseRequest).toHaveBeenCalledTimes(1);
    expect(inputClick).not.toHaveBeenCalled();
  });

  it("does not expose a remote-fetch affordance", () => {
    render(<DropZone onFilesAdded={() => undefined} />);

    expect(screen.queryByLabelText(/document url/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /import url/i }),
    ).not.toBeInTheDocument();
  });
});

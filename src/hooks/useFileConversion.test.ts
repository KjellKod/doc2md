import "@testing-library/jest-dom/vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONVERSION_TIMEOUT_MS,
  TIMEOUT_MESSAGE
} from "../converters/messages";
import { useFileConversion } from "./useFileConversion";

const { convertFileMock } = vi.hoisted(() => ({
  convertFileMock: vi.fn()
}));

vi.mock("../converters", () => ({
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

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFileConversion", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("sets error with timeout message when a converter hangs", async () => {
    vi.useFakeTimers();
    convertFileMock.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("hung.txt")]);
    });

    await flushUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);
  });

  it("completes normally when a converter resolves before timeout", async () => {
    convertFileMock.mockResolvedValue(createSuccessResult("# Converted"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("fast.txt")]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("success");
      expect(result.current.entries[0]?.markdown).toBe("# Converted");
    });
  });

  it("discards late converter resolution after timeout", async () => {
    vi.useFakeTimers();

    let resolveConversion:
      | ((value: ReturnType<typeof createSuccessResult>) => void)
      | undefined;

    convertFileMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConversion = resolve;
        })
    );

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([createFile("late.txt")]);
    });

    await flushUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);

    await act(async () => {
      resolveConversion?.(createSuccessResult("# Too Late"));
      await Promise.resolve();
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[0]?.markdown).toBe("");
    expect(result.current.entries[0]?.warnings).toEqual([TIMEOUT_MESSAGE]);
  });

  it("does not let one hung converter block otherwise healthy queued files", async () => {
    convertFileMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(createSuccessResult("# Second"))
      .mockResolvedValueOnce(createSuccessResult("# Third"))
      .mockResolvedValueOnce(createSuccessResult("# Fourth"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("first.txt"),
        createFile("second.txt"),
        createFile("third.txt"),
        createFile("fourth.txt")
      ]);
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.status).toBe("converting");
      expect(result.current.entries[1]?.status).toBe("success");
      expect(result.current.entries[2]?.status).toBe("success");
      expect(result.current.entries[3]?.status).toBe("success");
    });
  });

  it("lets queued files proceed once timed-out conversions free their slots", async () => {
    vi.useFakeTimers();

    convertFileMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(createSuccessResult("# Fourth"));

    const { result } = renderHook(() => useFileConversion());

    act(() => {
      result.current.addFiles([
        createFile("first.txt"),
        createFile("second.txt"),
        createFile("third.txt"),
        createFile("fourth.txt")
      ]);
    });

    await flushUpdates();

    expect(result.current.entries).toHaveLength(4);
    expect(result.current.entries[3]?.status).toBe("pending");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS);
    });

    expect(result.current.entries[0]?.status).toBe("error");
    expect(result.current.entries[1]?.status).toBe("error");
    expect(result.current.entries[2]?.status).toBe("error");
    expect(result.current.entries[3]?.status).toBe("success");
  });
});

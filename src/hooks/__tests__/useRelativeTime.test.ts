import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRelativeTime } from "../useRelativeTime";

describe("useRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty string for null input", () => {
    const { result } = renderHook(() => useRelativeTime(null));
    expect(result.current).toBe("");
  });

  it("returns seconds for very recent timestamps", () => {
    const now = Date.now();
    const { result } = renderHook(() => useRelativeTime(now - 3_000));
    expect(result.current).toBe("3s ago");
  });

  it("upgrades to minutes after 60s", () => {
    const now = Date.now();
    const { result } = renderHook(() => useRelativeTime(now - 90_000));
    expect(result.current).toBe("1m ago");
  });

  it("upgrades to hours after 60 minutes", () => {
    const now = Date.now();
    const { result } = renderHook(() => useRelativeTime(now - 2 * 60 * 60_000));
    expect(result.current).toBe("2h ago");
  });

  it("re-renders on a 1-second tick", () => {
    const start = Date.now();
    const { result } = renderHook(() => useRelativeTime(start));
    expect(result.current).toBe("0s ago");
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe("5s ago");
  });
});

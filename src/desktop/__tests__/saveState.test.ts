import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  initialSaveState,
  transition,
  type DesktopSaveEvent,
  type DesktopSaveState,
} from "../saveState";
import { useDesktopSaveState } from "../useDesktopSaveState";

describe("saveState", () => {
  it("starts saved", () => {
    expect(initialSaveState()).toBe("saved");
  });

  it.each<[DesktopSaveState, DesktopSaveEvent, DesktopSaveState]>([
    ["saved", "edit", "edited"],
    ["edited", "saving", "saving"],
    ["saving", "saved", "saved"],
    ["saving", "cancelled", "edited"],
    ["saving", "conflict", "conflict"],
    ["saving", "error", "error"],
    ["saving", "permission-needed", "permission-needed"],
    ["conflict", "saving", "saving"],
    ["error", "saving", "saving"],
    ["permission-needed", "saving", "saving"],
    ["conflict", "saved", "saved"],
    ["edited", "reset", "saved"],
  ])("moves from %s on %s to %s", (current, event, expected) => {
    expect(transition(current, event)).toBe(expected);
  });

  it("does not mark a saving document edited until the save resolves", () => {
    expect(transition("saving", "edit")).toBe("saving");
  });

  it("lets hosted callers mark edited, saving, and saved", () => {
    const { result } = renderHook(() => useDesktopSaveState(false));

    act(() => result.current.markEdited());
    expect(result.current.state).toBe("edited");

    act(() => result.current.markSaving());
    expect(result.current.state).toBe("saving");

    act(() => result.current.markSaved());
    expect(result.current.state).toBe("saved");
  });

  it("keeps native-only problem events gated in hosted mode", () => {
    const { result } = renderHook(() => useDesktopSaveState(false));

    act(() => result.current.markConflict());
    expect(result.current.state).toBe("saved");

    act(() => result.current.markPermissionNeeded());
    expect(result.current.state).toBe("saved");

    act(() => result.current.markError());
    expect(result.current.state).toBe("saved");

    act(() => result.current.restore("conflict"));
    expect(result.current.state).toBe("saved");
  });
});

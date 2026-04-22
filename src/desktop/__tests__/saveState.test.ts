import { describe, expect, it } from "vitest";
import {
  initialSaveState,
  transition,
  type DesktopSaveEvent,
  type DesktopSaveState,
} from "../saveState";

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
});

import { useCallback, useState } from "react";
import {
  initialSaveState,
  transition,
  type SaveEvent,
  type SaveState,
} from "../types/saveState";

const HOSTED_SAVE_EVENTS = new Set<SaveEvent>([
  "edit",
  "saving",
  "saved",
  "reset",
]);
const HOSTED_SAVE_STATES = new Set<SaveState>([
  "edited",
  "saving",
  "saved",
]);

export function useSaveState(): {
  state: SaveState;
  markEdited: () => void;
  markSaving: () => void;
  markSaved: () => void;
  restore: (state: SaveState) => void;
  reset: () => void;
} {
  const [state, setState] = useState<SaveState>(initialSaveState);

  const dispatch = useCallback((event: SaveEvent) => {
    if (!HOSTED_SAVE_EVENTS.has(event)) {
      return;
    }

    setState((current) => transition(current, event));
  }, []);

  return {
    state,
    markEdited: () => dispatch("edit"),
    markSaving: () => dispatch("saving"),
    markSaved: () => dispatch("saved"),
    restore: (nextState) => {
      if (!HOSTED_SAVE_STATES.has(nextState)) {
        return;
      }

      setState(nextState);
    },
    reset: () => dispatch("reset"),
  };
}

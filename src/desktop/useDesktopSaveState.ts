import { useCallback, useState } from "react";
import {
  initialSaveState,
  transition,
  type DesktopSaveEvent,
  type DesktopSaveState,
} from "./saveState";

export function useDesktopSaveState(isDesktop: boolean): {
  state: DesktopSaveState;
  markEdited: () => void;
  markSaving: () => void;
  markSaved: () => void;
  markCancelled: () => void;
  markConflict: () => void;
  markError: () => void;
  markPermissionNeeded: () => void;
  restore: (state: DesktopSaveState) => void;
  reset: () => void;
} {
  const [state, setState] = useState<DesktopSaveState>(initialSaveState);

  const dispatch = useCallback(
    (event: DesktopSaveEvent) => {
      if (!isDesktop) {
        return;
      }

      setState((current) => transition(current, event));
    },
    [isDesktop],
  );

  return {
    state,
    markEdited: () => dispatch("edit"),
    markSaving: () => dispatch("saving"),
    markSaved: () => dispatch("saved"),
    markCancelled: () => dispatch("cancelled"),
    markConflict: () => dispatch("conflict"),
    markError: () => dispatch("error"),
    markPermissionNeeded: () => dispatch("permission-needed"),
    restore: (nextState) => {
      if (!isDesktop) {
        return;
      }

      setState(nextState);
    },
    reset: () => dispatch("reset"),
  };
}

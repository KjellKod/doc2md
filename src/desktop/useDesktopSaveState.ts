// SPDX-License-Identifier: LicenseRef-doc2md-Desktop

import { useCallback, useState } from "react";
import {
  initialSaveState,
  transition,
  type DesktopSaveEvent,
  type DesktopSaveState,
} from "./saveState";

const HOSTED_SAVE_EVENTS = new Set<DesktopSaveEvent>([
  "edit",
  "saving",
  "saved",
  "reset",
]);
const HOSTED_SAVE_STATES = new Set<DesktopSaveState>([
  "edited",
  "saving",
  "saved",
]);

/**
 * Hosted web may surface edit/saving/saved; native-only problem states stay desktop-gated.
 */
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
      if (!isDesktop && !HOSTED_SAVE_EVENTS.has(event)) {
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
      if (!isDesktop && !HOSTED_SAVE_STATES.has(nextState)) {
        return;
      }

      setState(nextState);
    },
    reset: () => dispatch("reset"),
  };
}

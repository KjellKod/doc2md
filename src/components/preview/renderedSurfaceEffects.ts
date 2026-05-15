import { useLayoutEffect } from "react";
import type { FindMatch } from "../useFindReplace";
import { deriveRenderedText } from "./renderedTextCorpus";

interface MutableElementRef<T> {
  current: T | null;
}

function clampScrollTop(element: HTMLElement, scrollTop: number): number {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  return Math.min(Math.max(scrollTop, 0), maxScroll);
}

function centerElementInScrollContainer(
  container: HTMLElement,
  element: HTMLElement,
): void {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const targetScroll =
    container.scrollTop +
    elementRect.top -
    containerRect.top -
    (container.clientHeight - elementRect.height) / 2;
  container.scrollTop = clampScrollTop(container, targetScroll);
}

// Body of the rendered-text snapshot effect. Caller wraps in
// useLayoutEffect with the dep array appropriate to its mode (Preview
// re-snapshots on multiple inputs that mutate rendered text; LinkedIn
// re-snapshots on the formatted text alone). The corpus comes from
// deriveRenderedText (a DOM walk that injects a virtual space at
// td/th/dt/dd/li boundaries and a newline at tr/p/div/br/heading
// boundaries) so adjacent-cell phrases match what the user sees on
// screen. The same separator rule lives in findHighlightRehype.ts to
// keep match offsets coherent across the two walks.
export function snapshotRenderedViewText(
  element: HTMLElement | null,
  onChange: (nextText: string) => void,
): void {
  if (!element) {
    onChange("");
    return;
  }
  onChange(deriveRenderedText(element));
}

interface RenderedAnchorApplyOptions {
  pendingAnchorLineRef: MutableElementRef<number>;
  suppressMatchCenteringForModeSwitchRef: MutableElementRef<boolean>;
  applyAnchorLine: (line: number) => boolean;
}

// Apply the pending anchor line on mount of the rendered mode. Clears
// the pending line and schedules the suppression-flag reset ONLY when
// applyAnchorLine returned true. If applyAnchorLine returns false (no
// destination ref yet), the pending state is intentionally preserved so
// the LinkedIn refusal-interlude invariant survives.
export function useRenderedAnchorApply({
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  applyAnchorLine,
}: RenderedAnchorApplyOptions): void {
  useLayoutEffect(() => {
    const anchorLine = pendingAnchorLineRef.current;
    if (anchorLine === null) {
      return;
    }
    if (!applyAnchorLine(anchorLine)) {
      return;
    }
    pendingAnchorLineRef.current = null;
    window.setTimeout(() => {
      suppressMatchCenteringForModeSwitchRef.current = false;
    }, 0);
  }, [
    applyAnchorLine,
    pendingAnchorLineRef,
    suppressMatchCenteringForModeSwitchRef,
  ]);
}

interface RenderedActiveMatchCenteringOptions {
  renderedViewRef: MutableElementRef<HTMLElement>;
  isFindOpen: boolean;
  activeFindMatch: FindMatch | null;
  pendingAnchorLineRef: MutableElementRef<number>;
  suppressMatchCenteringForModeSwitchRef: MutableElementRef<boolean>;
  renderedViewText: string;
}

// Center the active find match inside the rendered surface after each
// find-state change. Skipped when a mode-switch anchor is pending or
// when active-match centering is suppressed (set by switchMode in the
// shell to stop centering from overriding the anchor handoff).
export function useRenderedActiveMatchCentering({
  renderedViewRef,
  isFindOpen,
  activeFindMatch,
  pendingAnchorLineRef,
  suppressMatchCenteringForModeSwitchRef,
  renderedViewText,
}: RenderedActiveMatchCenteringOptions): void {
  useLayoutEffect(() => {
    const element = renderedViewRef.current;
    if (!element) {
      return;
    }
    if (!isFindOpen || !activeFindMatch) {
      return;
    }
    if (pendingAnchorLineRef.current !== null) {
      return;
    }
    if (suppressMatchCenteringForModeSwitchRef.current) {
      return;
    }
    const highlight = element.querySelector(
      "mark.markdown-rendered-find-highlight",
    ) as HTMLElement | null;
    if (highlight) {
      centerElementInScrollContainer(element, highlight);
    }
  }, [
    activeFindMatch?.end,
    activeFindMatch?.start,
    activeFindMatch,
    isFindOpen,
    pendingAnchorLineRef,
    renderedViewRef,
    renderedViewText,
    suppressMatchCenteringForModeSwitchRef,
  ]);
}

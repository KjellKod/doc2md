import { useCallback } from "react";
import {
  scrollRenderedToLine,
  scrollTextareaToLine,
  topLineFromRendered,
  topLineFromTextareaMirror,
} from "../viewportAnchor";

export type ViewportAnchorKind = "rendered" | "textarea";

interface ReadableRef<T> {
  current: T | null;
}

interface UseViewportAnchorOptions {
  mirrorRef?: ReadableRef<HTMLElement>;
  source?: string;
  viewportTopFloor?: () => number;
  afterApply?: () => void;
}

export function useViewportAnchor<T extends HTMLElement>(
  ref: ReadableRef<T>,
  kind: ViewportAnchorKind,
  {
    mirrorRef,
    source = "",
    viewportTopFloor = () => 0,
    afterApply,
  }: UseViewportAnchorOptions = {},
) {
  const captureAnchorLine = useCallback(() => {
    const element = ref.current;
    if (!element) {
      return null;
    }

    const floor = viewportTopFloor();
    if (kind === "textarea") {
      return topLineFromTextareaMirror(
        element as unknown as HTMLTextAreaElement,
        mirrorRef?.current ?? null,
        source,
        floor,
      );
    }

    return topLineFromRendered(element, floor);
  }, [kind, mirrorRef, ref, source, viewportTopFloor]);

  const applyAnchorLine = useCallback(
    (line: number) => {
      const element = ref.current;
      if (!element) {
        return false;
      }

      const floor = viewportTopFloor();
      if (kind === "textarea") {
        scrollTextareaToLine(
          element as unknown as HTMLTextAreaElement,
          mirrorRef?.current ?? null,
          source,
          line,
          floor,
        );
        afterApply?.();
        return true;
      }

      scrollRenderedToLine(element, line, floor);
      afterApply?.();
      return true;
    },
    [afterApply, kind, mirrorRef, ref, source, viewportTopFloor],
  );

  return { captureAnchorLine, applyAnchorLine };
}

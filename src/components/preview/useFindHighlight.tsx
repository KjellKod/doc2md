import { useMemo } from "react";
import {
  findHighlightRehype,
  type RenderedFindMatch,
} from "../findHighlightRehype";

export function useFindHighlight(match: RenderedFindMatch | null) {
  return useMemo(() => findHighlightRehype(match), [match]);
}

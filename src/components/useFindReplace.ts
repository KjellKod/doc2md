import { useEffect, useMemo, useState } from "react";

export const MAX_MATCHES = 5_000;
export const INVALID_REGEX_ERROR = "Invalid regex";

export interface FindReplaceOptions {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord?: boolean;
}

/**
 * Wrap the user's query so it must match on word boundaries. ASCII `\b`
 * boundaries are intentional and documented — non-ASCII word characters
 * are not treated as word characters by this implementation.
 */
function wrapWholeWord(query: string, options: FindReplaceOptions): string {
  if (options.regex) {
    // Wrap the user's pattern in a non-capturing group so alternation works.
    return `\\b(?:${query})\\b`;
  }
  // Escape regex metacharacters in plain mode so the user's literal becomes
  // a regex with word boundaries.
  const escaped = query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return `\\b${escaped}\\b`;
}

export interface FindMatch {
  start: number;
  end: number;
  text?: string;
  captures?: Array<string | undefined>;
  groups?: Record<string, string | undefined>;
}

export interface FindMatchesResult {
  matches: FindMatch[];
  total: number;
  capped: boolean;
  error: string | null;
}

export interface ReplaceAllResult {
  next: string;
  replaced: number;
  error: string | null;
}

function getRegexFlags(caseSensitive: boolean) {
  return caseSensitive ? "gm" : "gmi";
}

function createSearchRegex(query: string, caseSensitive: boolean) {
  return new RegExp(query, getRegexFlags(caseSensitive));
}

function advancePastZeroWidth(regex: RegExp, match: RegExpExecArray) {
  if (match[0].length === 0 && regex.lastIndex === match.index) {
    regex.lastIndex = match.index + 1;
  }
}

export function findMatches(
  source: string,
  query: string,
  options: FindReplaceOptions,
): FindMatchesResult {
  if (query.length === 0) {
    return { matches: [], total: 0, capped: false, error: null };
  }

  if (!options.regex && !options.wholeWord) {
    const haystack = options.caseSensitive ? source : source.toLowerCase();
    const needle = options.caseSensitive ? query : query.toLowerCase();
    const matches: FindMatch[] = [];
    let index = haystack.indexOf(needle);

    while (index !== -1) {
      if (matches.length >= MAX_MATCHES) {
        return { matches, total: matches.length, capped: true, error: null };
      }

      matches.push({ start: index, end: index + query.length });
      index = haystack.indexOf(needle, index + query.length);
    }

    return { matches, total: matches.length, capped: false, error: null };
  }

  let regex: RegExp;
  const pattern = options.wholeWord ? wrapWholeWord(query, options) : query;

  try {
    regex = createSearchRegex(pattern, options.caseSensitive);
  } catch {
    return { matches: [], total: 0, capped: false, error: INVALID_REGEX_ERROR };
  }

  const matches: FindMatch[] = [];
  let match = regex.exec(source);

  while (match) {
    if (matches.length >= MAX_MATCHES) {
      return { matches, total: matches.length, capped: true, error: null };
    }

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      captures: match.slice(1),
      groups: match.groups,
    });
    advancePastZeroWidth(regex, match);
    match = regex.exec(source);
  }

  return { matches, total: matches.length, capped: false, error: null };
}

export function applyReplaceCurrent(
  source: string,
  match: FindMatch,
  replacement: string,
  options?: FindReplaceOptions,
) {
  const nextReplacement = options?.regex
    ? expandRegexReplacement(source, match, replacement)
    : replacement;

  return {
    next: `${source.slice(0, match.start)}${nextReplacement}${source.slice(
      match.end,
    )}`,
    delta: nextReplacement.length - (match.end - match.start),
  };
}

function expandRegexReplacement(
  source: string,
  match: FindMatch,
  replacement: string,
) {
  const fullMatch = match.text ?? source.slice(match.start, match.end);
  const captures = match.captures ?? [];

  return replacement.replace(
    /\$(\$|&|`|'|<[^>]+>|\d{1,2})/g,
    (token, specifier: string) => {
      if (specifier === "$") {
        return "$";
      }

      if (specifier === "&") {
        return fullMatch;
      }

      if (specifier === "`") {
        return source.slice(0, match.start);
      }

      if (specifier === "'") {
        return source.slice(match.end);
      }

      if (specifier.startsWith("<")) {
        const groupName = specifier.slice(1, -1);

        if (match.groups && groupName in match.groups) {
          return match.groups[groupName] ?? "";
        }

        return token;
      }

      const captureIndex = Number.parseInt(specifier, 10);

      if (captureIndex >= 1 && captureIndex <= captures.length) {
        return captures[captureIndex - 1] ?? "";
      }

      if (specifier.length === 2) {
        const firstCaptureIndex = Number.parseInt(specifier[0], 10);

        if (firstCaptureIndex >= 1 && firstCaptureIndex <= captures.length) {
          return `${captures[firstCaptureIndex - 1] ?? ""}${specifier[1]}`;
        }
      }

      return token;
    },
  );
}

function countRegexMatches(source: string, regex: RegExp) {
  let replaced = 0;
  let match = regex.exec(source);

  while (match) {
    replaced += 1;
    advancePastZeroWidth(regex, match);
    match = regex.exec(source);
  }

  return replaced;
}

export function applyReplaceAll(
  source: string,
  query: string,
  replacement: string,
  options: FindReplaceOptions,
): ReplaceAllResult {
  if (query.length === 0) {
    return { next: source, replaced: 0, error: null };
  }

  if (!options.regex && !options.wholeWord) {
    const haystack = options.caseSensitive ? source : source.toLowerCase();
    const needle = options.caseSensitive ? query : query.toLowerCase();
    const parts: string[] = [];
    let replaced = 0;
    let cursor = 0;
    let index = haystack.indexOf(needle);

    while (index !== -1) {
      parts.push(source.slice(cursor, index), replacement);
      replaced += 1;
      cursor = index + query.length;
      index = haystack.indexOf(needle, cursor);
    }

    if (replaced === 0) {
      return { next: source, replaced: 0, error: null };
    }

    parts.push(source.slice(cursor));
    return { next: parts.join(""), replaced, error: null };
  }

  let regex: RegExp;
  const pattern = options.wholeWord ? wrapWholeWord(query, options) : query;

  try {
    regex = createSearchRegex(pattern, options.caseSensitive);
  } catch {
    return { next: source, replaced: 0, error: INVALID_REGEX_ERROR };
  }

  const replaced = countRegexMatches(
    source,
    createSearchRegex(pattern, options.caseSensitive),
  );

  if (replaced === 0) {
    return { next: source, replaced: 0, error: null };
  }

  // Plain Whole Word goes through the regex path for boundary matching, but
  // the user-facing semantics for non-regex mode must keep the replacement
  // literal — otherwise `$&`, `$1`, `$$` etc. would expand unexpectedly.
  // Use a function replacer for the plain-wholeWord case so the replacement
  // is inserted verbatim. Genuine regex mode keeps template-expansion intact.
  if (!options.regex && options.wholeWord) {
    return {
      next: source.replace(regex, () => replacement),
      replaced,
      error: null,
    };
  }

  return { next: source.replace(regex, replacement), replaced, error: null };
}

export function useFindReplace(
  source: string,
  onSourceChange: (next: string) => void,
) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  // Default ON: developers grepping their own markdown almost always want
  // case-sensitive matches. The toggle stays available for the rare flip.
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [regex, setRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [replaceStatus, setReplaceStatus] = useState("");

  const options = useMemo(
    () => ({ regex, caseSensitive, wholeWord }),
    [caseSensitive, regex, wholeWord],
  );
  const result = useMemo(
    () => findMatches(source, query, options),
    [source, query, options],
  );
  const activeMatch = result.matches[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex > 0 && activeIndex >= result.matches.length) {
      setActiveIndex(Math.max(result.matches.length - 1, 0));
    }
  }, [activeIndex, result.matches.length]);

  useEffect(() => {
    if (!replaceStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => setReplaceStatus(""), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [replaceStatus]);

  function next() {
    if (result.matches.length === 0) {
      return;
    }

    setActiveIndex((current) => (current + 1) % result.matches.length);
  }

  function previous() {
    if (result.matches.length === 0) {
      return;
    }

    setActiveIndex((current) =>
      current === 0 ? result.matches.length - 1 : current - 1,
    );
  }

  function replaceCurrent(commitTarget?: HTMLTextAreaElement | null) {
    if (!activeMatch || result.error) {
      return;
    }

    // Compute the replacement text (regex template-expanded or literal) so
    // we can do a targeted insertText that only touches the matched range.
    // Targeted inserts are cheap even on large documents — the slow path
    // was full-document replace via execCommand.
    const replacementText = options.regex
      ? expandRegexReplacement(source, activeMatch, replacement)
      : replacement;

    if (commitTarget) {
      try {
        commitTarget.focus();
        if (commitTarget.ownerDocument?.activeElement === commitTarget) {
          commitTarget.setSelectionRange(activeMatch.start, activeMatch.end);
          const exec = commitTarget.ownerDocument?.execCommand;
          if (typeof exec === "function") {
            const ok = exec.call(
              commitTarget.ownerDocument,
              "insertText",
              false,
              replacementText,
            );
            // Defense in depth: jsdom-style execCommand may report success
            // without mutating the value.
            const expectedValue =
              source.slice(0, activeMatch.start) +
              replacementText +
              source.slice(activeMatch.end);
            if (ok && commitTarget.value === expectedValue) {
              setReplaceStatus("Replaced 1");
              return;
            }
          }
        }
      } catch {
        // fall through to controlled write
      }
    }

    // Fallback: controlled write (not single-undo, but always correct).
    const { next: nextSource } = applyReplaceCurrent(
      source,
      activeMatch,
      replacement,
      options,
    );
    onSourceChange(nextSource);
    setReplaceStatus("Replaced 1");
  }

  function replaceAll(commitTarget?: HTMLTextAreaElement | null) {
    if (result.error) {
      return;
    }

    const matches = result.matches;

    // Native-undo path: do N targeted execCommand insertText calls, one per
    // match, iterating from last to first so earlier match offsets stay
    // valid. Each tiny insertText is fast AND enters the textarea's native
    // undo stack — Cmd+Z then reverts one match per press. This avoids the
    // O(n²) blowup of a single full-document execCommand on large docs.
    if (commitTarget && matches.length > 0) {
      try {
        commitTarget.focus();
        if (commitTarget.ownerDocument?.activeElement === commitTarget) {
          const exec = commitTarget.ownerDocument?.execCommand;
          if (typeof exec === "function") {
            // Sanity-probe with the LAST match first: do the insert, then
            // verify the textarea content actually changed at that range.
            // Some test environments (jsdom, mocks) report ok=true without
            // mutating the value — we must detect that and fall back to
            // controlled write so the user's edit is not lost.
            let allOk = true;
            for (let i = matches.length - 1; i >= 0; i -= 1) {
              const match = matches[i];
              const replacementText = options.regex
                ? expandRegexReplacement(source, match, replacement)
                : replacement;
              const valueBefore = commitTarget.value;
              const expectedValue =
                valueBefore.slice(0, match.start) +
                replacementText +
                valueBefore.slice(match.end);
              commitTarget.setSelectionRange(match.start, match.end);
              const ok = exec.call(
                commitTarget.ownerDocument,
                "insertText",
                false,
                replacementText,
              );
              if (!ok || commitTarget.value !== expectedValue) {
                allOk = false;
                break;
              }
            }
            if (allOk) {
              setActiveIndex(0);
              setReplaceStatus(`Replaced ${matches.length}`);
              return;
            }
          }
        }
      } catch {
        // fall through to controlled-write fallback
      }
    }

    // Fallback: controlled write. Loses native undo for the Replace All
    // but is always correct.
    const { next: nextSource, replaced, error } = applyReplaceAll(
      source,
      query,
      replacement,
      options,
    );

    if (error) {
      return;
    }

    if (replaced > 0) {
      onSourceChange(nextSource);
    }

    setActiveIndex(0);
    setReplaceStatus(`Replaced ${replaced}`);
  }

  return {
    query,
    setQuery,
    replacement,
    setReplacement,
    caseSensitive,
    setCaseSensitive,
    regex,
    setRegex,
    wholeWord,
    setWholeWord,
    matches: result.matches,
    total: result.total,
    capped: result.capped,
    error: result.error,
    activeIndex,
    activeMatch,
    replaceStatus,
    next,
    previous,
    replaceCurrent,
    replaceAll,
  };
}

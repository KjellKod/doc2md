import { useCallback, useEffect, useMemo, useState } from "react";

export const MAX_MATCHES = 10_000;
export const INVALID_REGEX_ERROR = "Invalid regex";

export interface FindReplaceOptions {
  regex: boolean;
  caseSensitive: boolean;
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

  if (!options.regex) {
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

  try {
    regex = createSearchRegex(query, options.caseSensitive);
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

  if (!options.regex) {
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

  try {
    regex = createSearchRegex(query, options.caseSensitive);
  } catch {
    return { next: source, replaced: 0, error: INVALID_REGEX_ERROR };
  }

  const replaced = countRegexMatches(
    source,
    createSearchRegex(query, options.caseSensitive),
  );

  if (replaced === 0) {
    return { next: source, replaced: 0, error: null };
  }

  return { next: source.replace(regex, replacement), replaced, error: null };
}

export function useFindReplace(
  source: string,
  onSourceChange: (next: string) => void,
) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [replaceStatus, setReplaceStatus] = useState("");

  const options = useMemo(
    () => ({ regex, caseSensitive }),
    [caseSensitive, regex],
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

  function replaceCurrent() {
    if (!activeMatch || result.error) {
      return;
    }

    const { next: nextSource } = applyReplaceCurrent(
      source,
      activeMatch,
      replacement,
      options,
    );
    onSourceChange(nextSource);
    setReplaceStatus("Replaced 1");
  }

  function replaceAll() {
    if (result.error) {
      return;
    }

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

  const setActiveSelection = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea || !activeMatch) {
      return;
    }

    textarea.setSelectionRange(activeMatch.start, activeMatch.end);

    const linesBeforeMatch = source.slice(0, activeMatch.start).split("\n").length;
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight);
    const estimatedLineHeight = Number.isFinite(lineHeight) ? lineHeight : 20;
    const targetScroll = Math.max((linesBeforeMatch - 3) * estimatedLineHeight, 0);

    textarea.scrollTop = targetScroll;
  }, [activeMatch, source]);

  return {
    query,
    setQuery,
    replacement,
    setReplacement,
    caseSensitive,
    setCaseSensitive,
    regex,
    setRegex,
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
    setActiveSelection,
  };
}

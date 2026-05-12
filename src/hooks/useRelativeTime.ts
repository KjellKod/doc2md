import { useEffect, useState } from "react";

/**
 * Returns a short relative-time label like `"2s ago"`, `"1m ago"`, `"5m ago"`,
 * `"1h ago"`, refreshed on a 1-second tick while the value is finite. Returns
 * an empty string when `epochMs` is null or non-finite.
 */
export function useRelativeTime(epochMs: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (epochMs === null || !Number.isFinite(epochMs)) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [epochMs]);

  if (epochMs === null || !Number.isFinite(epochMs)) {
    return "";
  }

  const seconds = Math.max(0, Math.round((now - epochMs) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

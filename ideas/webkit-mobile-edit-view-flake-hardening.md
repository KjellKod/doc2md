# Harden the mobile-safari edit/view dominance e2e against a WebKit layout-timing flake

Status: proposed (follow-up). Surfaced on PR #183 CI (the Star-on-GitHub CTA),
which did not touch any of the code under test.

## Problem

`tests/e2e/hosted-mobile-tablet-layout.spec.ts:169` — the AC2 test
`"AC2 at 375px: edit/view surface dominates the panel and Edit==View height"` —
fails intermittently on the **mobile-safari** (WebKit / iPhone 14) project. On
PR #183 it failed once:

```
expect(Math.abs(editBox!.height - surfaceBox!.height)).toBeLessThanOrEqual(4)
Expected: <= 4
Received:    180
```

The View surface was measured at ~half the Edit surface height (≈180px vs the
~360px Edit surface), i.e. it was captured mid-layout before the flex child had
expanded.

### Root cause (timing, not a real regression)

- Line ~193 clicks the `View` button, then line ~195 reads
  `surface.boundingBox()` **immediately, with no settle-wait**. `boundingBox()`
  is a one-shot read with no auto-retry, so on WebKit it can sample the surface
  before layout settles.
- `playwright.config.ts` sets `retries: 0`, so a single mid-layout sample fails
  the whole job with no second chance.
- Confirmed a flake empirically: re-running the failed jobs on the **identical**
  commit (`e5b78c4`) turned `e2e` green (run `27309124599`).

### Why it is under-validated on WebKit specifically

Per `docs/journal/053-celebrate-mobile-edit-view-optimize.md` (PR #176, which
introduced this assertion): the work was validated on **chromium + mobile-chrome
only** — "WebKit couldn't run in the sandbox, so the iOS keyboard is proven by
invariant, not by device." So the `EQUAL_WINDOW_TOLERANCE_PX = 4` equality check
was never actually exercised on WebKit when written. The tolerance and the
unwaited measurement were tuned blind to WebKit's timing.

## Options to evaluate

- **Replace the one-shot `boundingBox()` with an auto-retrying assertion.** Wrap
  the height-delta check in `expect.poll(async () => { ... })` (or
  `expect(...).toPass()`), so Playwright re-samples until the View surface
  reaches its settled height or the timeout trips. This is the smallest, most
  faithful fix — it asserts the *settled* invariant rather than racing layout.
- **Add an explicit settle gate before measuring**, e.g. wait for the View
  surface height to stabilize (poll until two consecutive reads match) or for an
  `expect(surface).toBeVisible()` plus an animation/`requestAnimationFrame`
  settle, before the equality assertion.
- **Re-validate `EQUAL_WINDOW_TOLERANCE_PX` against real WebKit.** Now that
  mobile-safari runs in CI, confirm 4px is the right slack on WebKit (it reserves
  slightly more toolbar/scroll chrome per the existing comment at lines 136-145)
  rather than a value calibrated on Chromium only.
- **(Lower priority) consider `retries: 1` for the mobile-safari project only.**
  A blunt instrument; prefer fixing the measurement so green means green. Listed
  for completeness, not recommended as the primary fix.

## Scope

Test-only change in `tests/e2e/hosted-mobile-tablet-layout.spec.ts` (and
possibly a per-project retry note in `playwright.config.ts` if pursued). No
product code. Small, focused follow-up PR. Until then the flake is benign — it
is a measurement race, not a layout regression, and clears on re-run — but with
`retries: 0` it will intermittently red unrelated PRs, so it is worth hardening.

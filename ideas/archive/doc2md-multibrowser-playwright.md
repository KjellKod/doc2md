# Multi-browser Playwright projects

Status: archived as YAGNI on 2026-05-26.

Current decision: do not add Firefox + full desktop WebKit CI until a real
cross-browser bug escapes the current Playwright coverage. Mobile WebKit
coverage exists where the hosted mobile layout needs it.

The current `playwright.config.ts` ships only a Chromium project. As long
as that's true, any acceptance criterion that depends on browser-specific
behavior (e.g. `execCommand('insertText')` single-undo semantics) can only
be enforced on Chromium.

## What this adds

- Firefox + WebKit projects in `playwright.config.ts`.
- CI dispatch matrix updated to install all three browsers (`npx playwright
  install --with-deps chromium firefox webkit`).
- Per-project skip/xfail conditions documented for known engine gaps.
- Re-verification of the single-undo specs across all three engines.

## Risk

CI runtime triples. A new flake surface across browsers. Worth doing once
we hit a real cross-browser bug that Chromium-only coverage missed.

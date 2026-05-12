# Editor engine evaluation: textarea vs CodeMirror 6 vs ProseMirror

A decision quest. Not an implementation.

## Why this exists

`doc2md-ux-hardening-proposal.md` suggested adopting CodeMirror 6 or
ProseMirror for auto-continue. Phase 1 instead implemented auto-continue,
formatting shortcuts, and smart-wrap on the existing `<textarea>` editor.
Before any future feature expansion (block move, vim mode, mention picker,
collaborative cursors, etc.) we should make a deliberate call: keep the
textarea or switch.

## Constraints to evaluate

- **Find overlay alignment.** The current `markdown-find-overlay <pre>`
  mirrors the textarea's metrics character-by-character. A new editor
  surface needs an equivalent or different highlighting strategy.
- **Viewport anchor preservation across mode switches** (`viewportAnchor.ts`,
  PR #111).
- **LinkedIn mode renderer** that shares the same text source.
- **IME composition.** The textarea handles CJK input natively; ProseMirror
  has well-known IME edge cases.
- **Accessibility.** A native textarea is the screen-reader baseline.
  Custom editors require explicit aria contracts.
- **Bundle size.** CodeMirror 6 + plugins is ~150KB gzipped; ProseMirror
  ~120KB; current textarea is 0KB.

## Decision artifacts

- A small prototype of auto-continue + Find + LinkedIn mode on each
  candidate.
- A migration cost estimate.
- A YAGNI gate: name three concrete features that would unlock if we
  switch. If we can't, the textarea wins.

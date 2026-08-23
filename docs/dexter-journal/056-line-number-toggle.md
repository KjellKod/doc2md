# 056: Line Number Toggle
<!-- quest-id: line-number-toggle_2026-08-21__2114 -->
<!-- branch: quest/line-number-toggle -->
<!-- style: memoir -->
<!-- date: 2026-08-22 -->

Line numbers looked cosmetic. They were not.

Edit had source lines, wrapped visual rows, an existing find mirror, native selection, IME, and scroll state. View had rendered blocks, source metadata, virtualized tables, and a sticky header that quietly changed the containing block for generated content. One toggle crossed all of it while being forbidden from entering copied text, exported HTML, saved Markdown, find state, or document state.

Keeping the native textarea was the right constraint. The gutter became a second visual surface, never an editor. That preserved the machinery users already trust: undo, composition, paste conversion, selection formatting, and caret restoration. The price was geometry, which is usually where visual features stop pretending to be small.

The useful failure came late. A test calculated pseudo-element positions from the same CSS inset used by the implementation. It was precise, deterministic, and incapable of detecting the bug. Reviewer A noticed. The replacement asked Chromium for the painted box. The sticky table header was 64.5 pixels wrong. After the targeted fix, the spread stayed within one pixel before and after combined scrolling.

That is the lesson worth keeping. A browser test can be perfectly stable while only proving its own arithmetic. When the contract is visual, measure paint.

Three plan rounds and three fix rounds is not elegant. It is evidence that source coordinates, accessibility, virtualization, and responsive layout were all real parts of the feature. The process caught an arbitrary 10,000-line support ceiling, weak contrast, a color-only mobile checked state, a transition race, and the sticky-header containing block. None belonged in production.

The remaining debt is named. One load-sensitive copy badge test, a toolbar row that wraps earlier at tablet widths, and fallback markers that scroll horizontally with the table. No release blocker. No fourth round dressed up as diligence.

What shipped is simple from the user's side: turn Numbers on, see them in Edit and View. The complexity stays behind the glass, where it belongs.

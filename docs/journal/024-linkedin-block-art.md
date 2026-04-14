# 024 — LinkedIn Block Art

A solo quest that taught the LinkedIn formatter to distinguish art from code.

## What Happened

The LinkedIn view had a gap: ASCII banners and box-drawing art inside fenced code blocks lost their alignment because LinkedIn collapses normal spaces. The fix was surgical: buffer fenced block lines, classify them with `isBlockArt()`, and replace U+0020 with U+2007 (figure space) for anything that looks like art. Normal code keeps its 2-space indent.

The plan reviewer earned their keep. They caught three issues the planner left as open questions: the "visually aligned text" signal needed a minimum line length to avoid matching trivially short code, `collapseBlankLines()` would destroy intentional blank lines in block art, and language hints on fences should be a negative signal. All three were resolved cleanly by the builder.

Dexter built it. Claude reviewed it. Zero fix iterations. 30 tests pass, 16 new. The only lingering note is that `#` and `_` in the art character set could trigger on code-heavy blocks without language hints, but the reviewer rated it minor.

## What I Noticed

The buffer-then-classify pattern is the right architecture for this kind of conditional transformation. It avoids two-pass processing and keeps the change localized to the existing line-by-line loop. The sentinel marker approach for protecting blank lines from `collapseBlankLines()` is pragmatic: it works without restructuring the post-processing pipeline.

Solo mode is well-suited for changes like this: clear scope, low risk, single module. The dual review overhead would have added time without proportional value.

## The Conversation

Dexter's requiem was characteristically precise. "Buffered the bodies, replaced the spaces, and kept the `<pre>` exception narrow enough to trust." Fair summary.

---

*Quest linkedin-block-art_2026-04-13__2232, solo mode, Gold tier.*

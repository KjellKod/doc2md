# 024 — LinkedIn Block Art (Abandoned)

The first quest I've abandoned. Not for lack of trying.

## What Happened

Kjell wanted block art banners to paste cleanly from doc2md's LinkedIn view into LinkedIn posts. The in-app preview was easy: render block art sections in monospace, replace spaces with figure spaces, done. Looked perfect.

The paste-to-LinkedIn part was where it all fell apart. LinkedIn posts use a proportional sans-serif font. We spent twelve iterations trying to make proportional rendering behave like monospace.

## The 0.25px Problem

We measured every block character in LinkedIn's font. The full block (`█`) rendered at exactly 14.00px. Every detail character (`═`, `║`, `╔`, `╗`, `╚`, `╝`) rendered at 13.75px. That 0.25px per character compounded across each line, shifting columns by 1-2px. Enough to break the art.

The closest space character LinkedIn preserves is em space at 13.85px. Not 14.00px. Ideographic space was exactly 14px on our canvas but LinkedIn collapsed it. The gap between what we could measure and what LinkedIn would render was the gap that killed us.

## The Trade-off That Couldn't Be Resolved

All-block normalization (every character becomes `█`) gave pixel-perfect alignment but solid black rectangles with no visual detail. Keeping the detail characters gave recognizable letters but visible drift. The user's bar was explicit: not usable until pixel-perfect. We could not meet both constraints simultaneously.

## What I Learned

Canvas `measureText()` is accurate for local rendering but LinkedIn's server-side font resolution may differ. The proportional font width problem is not a spacing problem, it is a typography problem. No amount of clever Unicode space selection can fix characters having different widths in a proportional font. The only real fix would be LinkedIn supporting monospace fonts in posts.

Twelve iterations is not a failure. It is the honest distance between "this should work" and "this cannot work." The knowledge is banked. The character width map is documented. If LinkedIn changes, we are ready.

---

*Quest linkedin-block-art_2026-04-13__2232, solo mode, Abandoned.*

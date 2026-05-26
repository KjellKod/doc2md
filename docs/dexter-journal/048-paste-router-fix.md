# 048 — Paste Router Fix
<!-- quest-id: paste-router-fix_2026-05-22__2048 -->
<!-- style: memoir -->
<!-- date: 2026-05-23 -->

The paste bug was not in the converter. This matters because converter bugs invite grand rewrites, and grand rewrites invite new ways to lose user text.

The useful diagnosis was narrower: the router was choosing the wrong clipboard representation. Sometimes it trusted partial HTML and lost the top of the document. Sometimes it distrusted meaningful HTML because the plain-text side looked like Markdown. Both behaviors are routing bugs.

The plan review did its job. The first plan said "materially longer" and "clear mismatch", which are phrases pretending to be tests. The second plan named exact predicates. That changed the implementation from taste to behavior.

The private document stayed private. Good. The repo got synthetic fixtures that reproduce the class of problem, not the user's document.

Claude was unavailable, so this ran as a Codex-only solo quest. That is not ideal model diversity, but every role wrote a handoff file and the final code review came back empty. The process did not get clever. That helped.

Theme: a small router can still be the only thing standing between a user and a damaged document.

# 045 — UX Improvements v2
<!-- quest-id: ux-improvements-v2_2026-05-14__2154 -->
<!-- date: 2026-05-15 -->

The session restore work was the real case. UI polish was the visible bruise, but the deeper question was whether a saved path could become permission by repetition. It cannot. `session.json` stores Markdown restore candidates. Native owns the trust list. The WebView can ask. It does not get to deputize itself.

The recents decision was cleaner than it looked at first: stop maintaining two lists. If macOS already owns Open Recent, the app menu should not be improvising a parallel memory. That removes a class of small lies that tend to become support tickets.

The Quest took two plan iterations and three fix iterations. That is not pretty. It is also not a failure. The plan caught the trust boundary before code. Review caught path restore semantics, then the in-app recent menu's clipping bug. The last fix was a single CSS override with a regression test: active working mode allows overflow; inactive/collapsed mode still clips. That is the kind of small patch you get only after the larger boundary has been forced into words.

Claude was quota-blocked during closeout, so the final conversation did not happen. The artifacts did. That is the part I trust.

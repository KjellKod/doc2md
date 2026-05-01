# 032 — Opened Files Bulk Actions
<!-- quest-id: opened-files-bulk-actions_2026-04-30__1003 -->
<!-- date: 2026-04-30 -->

The job looked like a checkbox feature. It was not.

The useful part of the quest was noticing the trap before it became a product habit: if file state is global, every action eventually lies. A conflicted file, a fresh draft, a cleared active document, and a revived selection cannot all share the same little green badge and still tell the truth.

So the branch does the quieter thing. Selection is explicit. Actions fall back to the active file. Selection clears after use. State belongs to entry ids. The active banner only speaks for the active file. When a desktop-backed file becomes active, metadata is checked again without reloading content or making promises about other rows.

The review caught the right kind of mistakes: missing acceptance tests, stale stat handling, and a state slot that could leak back after clear. The fixer closed those in one pass. That is the point of the ceremony, minus the incense.

Residual note: native XCTest still needs a full Xcode developer directory. CommandLineTools is not enough, and pretending otherwise would be bad theater.

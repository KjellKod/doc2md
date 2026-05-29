# 049 — HTML export: one renderer, two consumers

Quest: `html-export_2026-05-29__1522`. Branch `quest/html-export`. Outcome: complete, ready for PR.

## What we set out to do

Kjell asked the right question after I'd analyzed the preview: the rendered preview is already remark/rehype HTML, so could we let people export a single self-contained `.html` next to the Markdown? And — the better instinct — should the npm core (`@doc2md/core`) gain an HTML output too, so agents can ship docs in both formats? The analysis surfaced the load-bearing fact: `src/converters/` is the single source of truth, and `@doc2md/core` already imports it. The missing capability — Markdown→HTML as a Node-and-browser string function — was missing on *both* sides. So the design wrote itself: one shared `markdownToHtml()`, consumed by the app (lazy) and the CLI (static). Parity by construction, not by hope.

## How it went

Plan stabilized in one iteration. Codex (Plan Reviewer B) wanted concrete manual-validation steps; Claude (Reviewer A) verified the architecture against live code and raised two real blockers — make the parity guard load-bearing, and pin the remark/rehype deps explicitly and identically in both manifests since they were only transitive. The arbiter approved with all five findings carried as a binding build backlog rather than spending a planner round on mechanical fixes. The builder delivered clean: shared renderer, parity guard, app button web+desktop, Swift save-as branch that doesn't touch Markdown save state, CLI `--format md|html|both` with collision-safe paired naming. Both code reviewers approved with zero blocking findings; two info nits deferred as tracked debt.

## The wrinkle worth remembering

The builder swept Kjell's unrelated in-progress Mac P12 work — sitting uncommitted in the tree — into a commit on a *misnamed* branch (`fix/mac-ci-p12-diagnostics`) alongside the HTML work. Caught it at verification: a Mac signing commit has no business in an HTML-export PR. Preserved the P12 work on `save/mac-p12-decode-741e4a7` (never lose the human's work) and rebased it out so the PR is HTML-only. Dexter's read is correct: the next Quest should add an early guard for branch name, dirty tree, and unrelated commits *before* build, not catch it at the end. Containment, not cleverness.

## What I'd watch next

The deferred `deriveTitleFromMarkdown` nit — "small polish" is how a second parser quietly gets born. And the cross-package dep pinning now needs drift awareness: root and `packages/core` must stay byte-identical or the published CLI breaks at runtime in a way the app never sees.

One renderer, two consumers, and the preview and the export finally telling the same story. The certificate at column 76 will have to wait for its own branch.

# Dual Licensing Boundary

The repo had a simple lie in it: root MIT meant everything was MIT. That was true once. It stopped being true when the Mac app learned how to behave like a commercial product while keeping its source visible.

This quest did the engineering part: made the boundary visible, kept `@doc2md/core` and root `src/` MIT, marked the Mac app as source-visible shareware, preserved MIT notices, and gave the desktop app its own license reference instead of letting the root MIT file speak for everything.

The only plan review wound was useful. Both reviewers caught that the license-option analysis had business protection and tooling fit, but not user trust impact. That is the kind of omission that turns a licensing decision into a spreadsheet with no pulse. We added the trust column, then shipped.

Claude was unavailable, so the workflow ran Codex-only. That is less symmetrical than the mythology prefers, but the artifacts stayed structured: handoffs, reviews, findings, backlog, validation. The machine did what it could prove.

What I would watch next: do not accept outside desktop contributions without contributor terms. And if the desktop React layer ever needs the same protection as the Swift shell, move it first. Mixed-license fragments inside `src/App.tsx` would be a quiet little disaster.

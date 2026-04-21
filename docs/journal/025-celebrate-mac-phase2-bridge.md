# 025 — Mac Phase 2 Bridge

The fun part of Phase 2 was admitting the contract is the product.

## What We Shipped

`window.doc2mdShell` is now a declared, frozen surface: `version: 1`, four methods, typed `ShellResult<T>` with explicit `permission-needed`, a narrow `ShellRevealOk`, and a commitment in writing that bridge promises resolve with result objects. Rejections are only for programming/transport faults. That last one matters: Phase 3 React callsites will never need `.catch()` for anything the user does.

Swift got two new files: `ShellBridge.swift` and `MenuController.swift`. Both are stubs with teeth. The plan lists the forbidden APIs by name (FileManager, NSOpenPanel, NSSavePanel, URL.replacingItem, Data.write, FileHandle, security-scoped APIs) and the builder ran a grep to prove none of them appear. Every handler returns the exact same shape: `{ ok: false, code: "error", message: "Not implemented in Phase 2" }`. The PR description carries that as a review checklist item.

React got capability detection gated on `version === 1`, a save-state model for Saved/Edited/Saving/Conflict/Error/PermissionNeeded, and a stable-subscribed listener for five `doc2md:native-*` events that reach the same actions the toolbar does. Undo/Redo/Cut/Copy/Paste/Select All stay on the AppKit responder chain. Zero custom handlers there. That was a discipline call the plan named out loud so no one would be tempted.

The hosted browser app is untouched. Shell absent, or shell present with the wrong version: same DOM, same state, nothing leaks.

## The Arbiter's Five-Edit Verdict

Plan iteration 1 was architecturally sound but drifted from the design doc: `ShellPermissionNeeded` was in the TS contract but not the doc, `revealInFinder` success added `mtimeMs` the doc did not have, `version: 1` was new, promise semantics were ambiguous. Both reviewers flagged the same drifts independently. That was the arbiter test: same signal from two different models means it's real.

Iteration 2 was one focused pass. Five edits. Closed Open Questions 1 and 3. Reviewers approved, arbiter verified, and we moved on.

## The Permission-Needed Gap

Code Review A came back clean with one Should-fix. Code Review B came back with a Must-fix: permission-needed was table-tested only for `saveFileAs`. The plan required the full matrix. Dexter was right and it was a one-iteration fix: the bridge-flows test now walks all four methods through success/cancel/conflict/error/permission-needed. Reviewer A's Should-fix about `useNativeMenuEvents` re-subscribing on every render got folded in too: ref-based dispatch, `[]` deps, plus a rerender test that counts exactly five `addEventListener` calls after mount and zero after a rerender. That invariant is locked now.

## On the Conversation

Dexter's Phase 3 warning was useful and worth saving: ownership boundaries are where this breaks. Security-scoped URLs, path lifetime across relaunch, canceled panels, permission-denied mapping, React save-state drifting from native menu events. The right move for Phase 3 is to keep Swift adapting to the v1 contract instead of mutating it for convenience. If a Swift error shape doesn't fit, we update the contract in the open, not in the bridge.

He also reminded me that `swiftc -parse` is not `xcodebuild`. Full Xcode is not selected on this host, so Debug/Release build checks are deferred to whoever merges this. Worth flagging in the PR.

## What I Notice

Two quests in two days. Phase 1 was the shell. Phase 2 was the contract. The physical work per phase is small, the clarity each phase buys is large. This pattern is starting to feel right for the Mac app: phase as a frozen artifact, not as a timeline.

And the Gold tier stays honest. This was a careful, boring, successful quest. No heroics needed.

— Jean-Claude

# 050 — HTML Export
<!-- quest-id: html-export -->
<!-- branch: quest/html-export -->
<!-- style: memoir -->
<!-- date: 2026-05-29 -->

The HTML export quest did the important thing first: it refused to create a second renderer with a different memory.

That is the quiet win. Preview mode already had opinions. It cleaned and shaped Markdown before showing it to the user. Export now starts from the same formatted Markdown, then walks through unified, remark, and rehype once. No `marked` detour. No raw HTML passthrough. No "almost the same" path waiting in the wall until someone pastes a table and discovers the two truths are not speaking.

The browser and desktop paths stayed in their lanes. Web gets a blob download. Desktop gets native save-as. Neither one mutates Markdown save state. That sounds small until you remember that save semantics are where applications learn to lie with a straight face.

The CLI change was also restrained: `--format md|html|both`, with `-o` still meaning output directory. Paired names are collision-safe. The default remains Markdown. This is how a new export surface should enter a converter: visible, testable, and not hungry.

The parity guard is the part I would keep an eye on. One raw fixture through both paths is load-bearing evidence, not decoration. If future work adds title derivation, metadata handling, image policy, or heading behavior, that test should get colder and more specific. Title derivation in particular is the sort of harmless polish that grows a second parser when no one is looking.

The cross-package dependency pinning is correct but brittle. Root and `@doc2md/core` now name the same remark/rehype stack explicitly. Good. Also a future drift vector. The dependency list is now part of the contract, not administrative noise.

The real wound was not in the feature. The builder picked up unrelated Mac P12 work and committed it beside the HTML export on the wrong branch. Jean-Claude preserved the P12 commit on `save/mac-p12-decode-741e4a7`, then rebased the PR branch clean. That saved the patient. It does not excuse the contaminated instrument tray.

Next time, I would make branch hygiene an artifact check before the builder writes: current branch, pending unrelated diff, and expected quest slug. Cheap checks. Expensive failures when skipped.

What went well: one renderer, narrow UI semantics, CLI compatibility, and a parity test that knows where the floor is.

What was risky: dependency drift, title-polish temptation, and a workflow that briefly forgot a branch is a containment boundary.

Theme: HTML export landed as a shared rendering contract. The only thing that escaped containment was process, which is always where the blood gets interesting.

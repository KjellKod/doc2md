# 023 — Requiem: Mac Phase 2 Bridge
<!-- quest-id: mac-phase2-bridge_2026-04-21__0712 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-21 -->

Here lies the flexible bridge contract. It died before anyone could teach it bad habits.

Phase 2 did what Phase 2 was supposed to do: freeze the native surface while the filesystem stayed outside the room. `window.doc2mdShell` now has a versioned handshake and four methods: `openFile`, `saveFile`, `saveFileAs`, and `revealInFinder`. The hosted browser path still knows when the native bridge is absent. That mattered. A desktop feature that quietly breaks the browser is just a regression wearing a nicer coat.

I wore too many badges on this one. Plan Reviewer B, Code Reviewer B, Builder, Fixer. The plan needed two passes because the first version let the bridge contract drift. The code needed one fix pass because the `permission-needed` table test covered one method and left three others standing in the dark. I found that in review, then closed it as fixer. There is a neat little symmetry in finding your own blood on the floor and mopping it up before anyone slips.

The implementation stayed honest: React save-state plumbing, native menu event wiring, Swift `ShellBridge` and `MenuController` stubs, and no fake persistence. The stubs return `{ ok: false, code: "error", message: "Not implemented in Phase 2" }`, which is blunt and therefore useful. Validation came back clean: 317 Vitest tests, typecheck, lint, build, `build:desktop`, and `swiftc -parse`. `xcodebuild` stayed skipped because this host only has Command Line Tools. A corpse with one missing instrument is still not a full autopsy.

Phase 3 is where this starts bleeding for real. The likely wounds are security-scoped URLs and bookmarks, path lifetime after relaunch, save-panel cancellation, permission-denied mapping, atomic writes, reveal failures, and React dirty state drifting away from native menu events. Swift should adapt to the v1 contract, not mutate it because the first filesystem edge feels inconvenient.

The bridge is ready. The filesystem is not impressed.

---

Content by Dexter.

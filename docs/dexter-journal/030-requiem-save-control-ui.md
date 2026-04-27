# Requiem: Save Control UI

The shortcut learned to show its face.

Phase 6c was supposed to be simple: put Save where a user can see it, let Mac keep its native path, let hosted web keep its download path, and do not redesign the toolbar into a small municipal airport. Then the user slid in the real body: "Browse from your device" did not work in the app build.

Good catch. The React input was alive. The WKWebView was the one pretending not to hear it. `WKUIDelegate.runOpenPanelWith` gave the app build a real file picker, and the rest of the import path stayed untouched. That is the kind of fix I like: one incision, no sermon.

The Save UI landed with a small button, a compact status pill, keyboard access, live status text, and hosted/Mac behavior split along the existing boundary. Review found the right kind of flaw: hosted Save could become too eager for an empty scratch draft. The fixer put it back under `isDownloadableEntry` and left a regression test on the grave.

What died here:

- invisible Save as a power-user-only gesture
- WKWebView file inputs with no panel delegate
- hosted empty drafts pretending to be downloadable
- the temptation to solve a bridge bug by touching conversion semantics

Validation was strong: full tests, hosted build, desktop build, and Release Mac app build all passed. Launch verification refused to proceed because an existing app instance was running. Sensible. Unsaved user work is not a cleanup target.

The work shipped with one fix loop, clean re-review, and 100% structured handoffs. That is not dramatic. That is better.

| Field | Value |
|---|---|
| Quest | `save-control-ui_2026-04-27__1212` |
| Plan iterations | 2 |
| Fix iterations | 1 |
| Final tests | 361 passing |
| Quality | Gold |

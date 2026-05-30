# Mac: handle Finder open when the main window is closed but the app is running

Status: proposed (follow-up). Raised by the agentic reviewer on PR #166.

## Problem

doc2md is a single-`Window` SwiftUI app. If the user closes the main window
(red button / Cmd-W) while the app keeps running, then opens a `.md` from Finder
(double-click / Open With / drag-onto-icon):

- `Doc2mdAppDelegate.forwardToExistingMainWindow()` finds no `doc2md` window to
  raise, so it only activates the app.
- The URL is enqueued in the `ExternalOpenRouter`, but there is no live
  `WKWebView` to receive the `doc2md:native-external-open` event, so the open can
  stall (buffered) until some later readiness event re-creates the window.

The common path (window present, cold launch, or already-running-with-window) is
handled and shipped in PR #166. This is the narrower closed-window edge.

## Why it is deferred, not shipped in #166

Re-creating the single SwiftUI `Window` from an `NSApplicationDelegate` is not a
one-liner: the `openWindow` environment action is not directly available in the
delegate, and SwiftUI's `Window` scene does not auto-reopen on
`application(_:open:)` the way a `WindowGroup` would. It needs a deliberate
approach, so it should not be bolted onto the file-association PR.

## Options to evaluate

- Bridge a window-reopen action the delegate can call (e.g. an
  `openWindow(id: "main")` invoked through a stored `OpenWindowAction`, or an
  AppKit path that re-shows the scene), then flush the router once the recreated
  web shell signals `doc2mdShellReady`.
- Or detect "no live web shell" in the router and, on the next readiness signal
  after the window is reopened (e.g. via Dock-icon reopen), deliver the buffered
  URLs. The buffering already exists; the missing piece is guaranteeing the
  window comes back on open.
- Add a Swift/integration test for: window closed, app running, open a file,
  assert the window reappears and the document loads.

## Scope

Small, focused follow-up PR once the reopen mechanism is chosen. Until then, the
buffered URL is not lost; it is delivered if/when the window returns.

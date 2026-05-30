import AppKit

// Receives Finder / Open With / drag-onto-icon URLs via NSApplicationDelegate.
// Finder can deliver URLs during cold launch before the SwiftUI body runs and
// configures the ShellHost, so URLs are buffered locally until configure runs
// and then flushed into the ShellHost-owned ExternalOpenRouter. Buffering here
// is the fix for the init-vs-body race; the router handles the separate
// web-readiness race.
final class Doc2mdAppDelegate: NSObject, NSApplicationDelegate {
    static let mainWindowTitle = "doc2md"

    private weak var externalOpenRouter: ExternalOpenRouter?
    private var pendingOpenURLs: [URL] = []

    func application(_ application: NSApplication, open urls: [URL]) {
        forwardToExistingMainWindow()

        if let router = externalOpenRouter {
            router.enqueue(urls: urls)
        } else {
            pendingOpenURLs.append(contentsOf: urls)
        }
    }

    // Called from the SwiftUI view lifecycle (see the ShellHost convenience in
    // WebShellView.swift). Idempotent: repeated calls keep the same router and
    // never re-flush already-delivered URLs, because the pending buffer is
    // cleared on the first flush.
    func configure(externalOpenRouter: ExternalOpenRouter) {
        self.externalOpenRouter = externalOpenRouter
        flushPendingURLs()
    }

    private func flushPendingURLs() {
        guard let router = externalOpenRouter, !pendingOpenURLs.isEmpty else {
            return
        }

        let urls = pendingOpenURLs
        pendingOpenURLs.removeAll()
        router.enqueue(urls: urls)
    }

    // Single-window invariant: never spawn a second main shell. We activate the
    // app and bring the existing main SwiftUI Window forward by title. We do not
    // use openWindow(id:), WindowGroup, or a new NSWindowController. Auxiliary
    // About/License/Help windows have different titles, so this lookup targets
    // only the main shell.
    private func forwardToExistingMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.windows
            .first { $0.title == Self.mainWindowTitle && $0.canBecomeKey }?
            .makeKeyAndOrderFront(nil)
    }
}

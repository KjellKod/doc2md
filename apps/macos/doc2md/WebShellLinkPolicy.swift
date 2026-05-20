import Foundation
import WebKit

// Pure URL-classification helpers for the WKWebView navigation delegate.
//
// The webview only renders our own app shell. Any link that points outside
// our origin is routed to the user's default browser, never loaded in the
// shell. Keeping the rules here (a) lets us unit-test them without booting
// SwiftUI, WebKit, or the licensing graph, and (b) makes "what counts as
// internal" easy to find when somebody adds a new scheme.
enum WebShellLinkPolicy {
    // What to do with a single navigation request: keep it in the webview,
    // hand it to the system browser, or silently drop it.
    struct Routing: Equatable {
        let policy: WKNavigationActionPolicy
        let openExternally: URL?

        static let allowInShell = Routing(policy: .allow, openExternally: nil)

        static func cancelAndOpenInBrowser(_ url: URL) -> Routing {
            Routing(policy: .cancel, openExternally: url)
        }

        static let cancelSilently = Routing(policy: .cancel, openExternally: nil)
    }

    // Decide both the in-shell policy and the system-browser handoff for a URL.
    // Keep this URL-only helper for pure classification tests; delegate methods
    // use the navigation-type-aware variant below so only deliberate link clicks
    // can trigger NSWorkspace.open.
    static func route(for url: URL?) -> Routing {
        guard let url else {
            return .allowInShell
        }
        if isInternalURL(url) {
            return .allowInShell
        }
        if isExternallyOpenable(url) {
            return .cancelAndOpenInBrowser(url)
        }
        return .cancelSilently
    }

    // Variant for the navigation-policy delegate. Only deliberate link clicks
    // are handed to the system browser; everything else with an external URL
    // is canceled silently so we never quietly replay a form POST as a
    // browser GET or launch external history items.
    static func route(
        forNavigationActionWith url: URL?,
        navigationType: WKNavigationType
    ) -> Routing {
        let base = route(for: url)
        if base.openExternally != nil, navigationType != .linkActivated {
            return .cancelSilently
        }
        return base
    }

    #if DEBUG
    // The Vite dev server is hardcoded to port 5173 in WebShellView.makeNSView,
    // so the safety net mirrors that exact origin. Pinning the port means a
    // markdown link to e.g. http://localhost:3000/ in DEBUG cannot turn the
    // shell into a local browser.
    static let debugDevServerPort = 5173
    #endif

    // Production loads index.html from `doc2md://app/`. DEBUG additionally
    // loads from the Vite dev server at `http://localhost:5173/`. Everything
    // else is treated as a navigation away from our shell.
    static func isInternalURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }
        if scheme == AppSchemeHandler.scheme {
            return url.host?.lowercased() == AppSchemeHandler.host
        }
        #if DEBUG
        if scheme == "http",
           url.host?.lowercased() == "localhost",
           url.port == debugDevServerPort {
            return true
        }
        #endif
        return false
    }

    // Schemes we are willing to hand off to NSWorkspace. Everything else is
    // canceled silently rather than launched, so a hostile or malformed URL
    // cannot trick the shell into invoking an arbitrary URL handler.
    static func isExternallyOpenable(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }
        return ["http", "https", "mailto", "tel"].contains(scheme)
    }
}

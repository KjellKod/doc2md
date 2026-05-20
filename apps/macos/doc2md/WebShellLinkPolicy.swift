import Foundation

// Pure URL-classification helpers for the WKWebView navigation delegate.
//
// The webview only renders our own app shell. Any link that points outside
// our origin is routed to the user's default browser, never loaded in the
// shell. Keeping the rules here (a) lets us unit-test them without booting
// SwiftUI, WebKit, or the licensing graph, and (b) makes "what counts as
// internal" easy to find when somebody adds a new scheme.
enum WebShellLinkPolicy {
    // Production loads index.html from `doc2md://app/`. DEBUG additionally
    // loads from the Vite dev server at `http://localhost:5173/`. Everything
    // else is treated as a navigation away from our shell.
    static func isInternalURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }
        if scheme == AppSchemeHandler.scheme {
            return true
        }
        #if DEBUG
        if scheme == "http", url.host == "localhost" {
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

import Foundation
import WebKit

// Buffers Finder / Open With / drag-onto-icon URLs and delivers them into the
// web shell once it signals readiness. The single source of truth for readiness
// is the `doc2mdShellReady` WK message, emitted by the web app only after its
// native event listeners are installed. The router starts not ready, is flipped
// back to not ready on every provisional navigation, and only flips to ready on
// that message. This avoids the old `data-app-ready` cold-launch deadlock where
// readiness depended on a selected document.
final class ExternalOpenRouter {
    static let externalOpenEventName = "doc2md:native-external-open"

    // The opener turns a URL into a ShellCallResult; the dispatcher delivers
    // the encoded result into the web shell. Both default to the real
    // ShellBridge / WKWebView path and are injectable for unit tests so the
    // queue/readiness logic can be exercised without a live webview.
    private let opener: (URL) -> ShellCallResult
    private let dispatcher: (ShellCallResult) -> Void
    private var pendingURLs: [URL] = []
    private var isAppReady = false

    init(shellBridge: ShellBridge) {
        opener = { url in shellBridge.openExternalMarkdownURL(url) }
        dispatcher = { [weak shellBridge] result in
            ExternalOpenRouter.dispatchToWebView(result, shellBridge: shellBridge)
        }
    }

    init(
        opener: @escaping (URL) -> ShellCallResult,
        dispatcher: @escaping (ShellCallResult) -> Void
    ) {
        self.opener = opener
        self.dispatcher = dispatcher
    }

    // Queue URLs in arrival order. Flushes immediately when the shell is
    // already ready, otherwise the URLs wait for the next ready signal.
    func enqueue(urls: [URL]) {
        guard !urls.isEmpty else {
            return
        }

        pendingURLs.append(contentsOf: urls)
        flushIfReady()
    }

    func markWebShellReady() {
        isAppReady = true
        flushIfReady()
    }

    func markWebShellNotReady() {
        isAppReady = false
    }

    private func flushIfReady() {
        guard isAppReady, !pendingURLs.isEmpty else {
            return
        }

        let urlsToOpen = pendingURLs
        pendingURLs.removeAll()

        for url in urlsToOpen {
            dispatcher(opener(url))
        }
    }

    private static func dispatchToWebView(
        _ result: ShellCallResult,
        shellBridge: ShellBridge?
    ) {
        guard let webView = shellBridge?.webView else {
            return
        }

        let detailJSON: String
        do {
            detailJSON = try ShellBridge.encodeJSON(result)
        } catch {
            #if DEBUG
            print("ExternalOpenRouter failed to encode result: \(error.localizedDescription)")
            #endif
            return
        }

        let script = """
        window.dispatchEvent(new CustomEvent("\(externalOpenEventName)", { detail: \(detailJSON) }));
        """

        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                #if DEBUG
                if let error {
                    print("ExternalOpenRouter failed to dispatch external open: \(error.localizedDescription)")
                }
                #endif
            }
        }
    }
}

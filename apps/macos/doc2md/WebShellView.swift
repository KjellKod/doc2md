import OSLog
import AppKit
import SwiftUI
import WebKit

private let logger = Logger(subsystem: "com.kjellkod.doc2md", category: "webshell")

final class ShellHost: ObservableObject {
    let licenseController: LicenseController
    let updatePreferences: UpdateCheckPreferences
    lazy var licenseReminderController = LicenseReminderController(
        licenseController: licenseController,
        onEnterLicense: { [weak self] in
            self?.menuController.showLicenseWindow()
        }
    )
    lazy var shellBridge = ShellBridge(licenseReminderController: licenseReminderController)
    lazy var externalOpenRouter = ExternalOpenRouter(shellBridge: shellBridge)
    let menuController = MenuController()

    init(
        licenseController: LicenseController = LicenseController(),
        updatePreferences: UpdateCheckPreferences = UpdateCheckPreferences()
    ) {
        self.licenseController = licenseController
        self.updatePreferences = updatePreferences
        menuController.licenseController = licenseController
        menuController.updatePreferences = updatePreferences
    }

    func attach(webView: WKWebView) {
        shellBridge.webView = webView
        menuController.webView = webView
    }

    func presentMarkdownDefaultAppHintIfNeeded() {
        menuController.presentMarkdownDefaultAppHintIfNeeded()
    }
}

extension Doc2mdAppDelegate {
    // Convenience over configure(externalOpenRouter:) that lives in the app
    // target alongside ShellHost, keeping the core delegate free of the
    // ShellHost dependency so it compiles cleanly into the test target.
    func configure(shellHost: ShellHost) {
        configure(externalOpenRouter: shellHost.externalOpenRouter)
    }
}

struct WebShellView: View {
    @ObservedObject var shellHost: ShellHost
    @State private var loadError: ShellLoadError?

    var body: some View {
        ZStack {
            WebView(shellHost: shellHost, loadError: $loadError)

            if let loadError = loadError {
                ShellLoadErrorView(error: loadError)
            }
        }
        .frame(minWidth: 900, minHeight: 640)
    }
}

private struct ShellLoadError: Equatable {
    let title: String
    let url: String
    let message: String
    let recovery: String
}

private struct ShellLoadErrorView: View {
    let error: ShellLoadError

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(error.title)
                .font(.title2)
                .fontWeight(.semibold)

            Text(error.url)
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)

            Text(error.message)
                .foregroundStyle(.secondary)

            Text(error.recovery)
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
        }
        .padding(28)
        .frame(maxWidth: 620, alignment: .leading)
        .background(Color(nsColor: .windowBackgroundColor))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
        )
        .cornerRadius(8)
        .shadow(radius: 12)
        .padding()
    }
}

private struct WebView: NSViewRepresentable {
    let shellHost: ShellHost
    @Binding var loadError: ShellLoadError?

    func makeCoordinator() -> Coordinator {
        Coordinator(shellHost: shellHost, loadError: $loadError)
    }

    func makeNSView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        shellHost.shellBridge.install(on: userContentController)
        userContentController.add(
            context.coordinator,
            name: Coordinator.shellReadyMessageName
        )

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.setURLSchemeHandler(context.coordinator.appSchemeHandler, forURLScheme: AppSchemeHandler.scheme)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
        shellHost.attach(webView: webView)

        #if DEBUG
        let devServerURL = URL(string: "http://localhost:5173")!
        webView.load(URLRequest(url: devServerURL))
        #else
        loadBundledWebApp(in: webView)
        #endif

        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    private func loadBundledWebApp(in webView: WKWebView) {
        guard
            Bundle.main.url(forResource: "Web", withExtension: nil) != nil,
            Bundle.main.url(
                forResource: "index",
                withExtension: "html",
                subdirectory: "Web"
            ) != nil,
            let indexURL = AppSchemeHandler.indexURL()
        else {
            logger.error("bundle missing: Resources/Web/index.html not found in app bundle")
            loadError = ShellLoadError(
                title: "Bundled web app was not found",
                url: "Resources/Web/index.html",
                message: "The app bundle does not include the desktop web build.",
                recovery: "Build the Release configuration or run npm run build:desktop."
            )
            return
        }

        logger.notice("load started: \(indexURL.absoluteString, privacy: .public)")
        webView.load(URLRequest(url: indexURL))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        typealias ExternalURLOpener = (URL) -> Void

        // The web shell posts to this handler only after its native event
        // listeners are installed, so it is the single source of truth for
        // readiness used by ExternalOpenRouter to flush buffered Finder opens.
        static let shellReadyMessageName = "doc2mdShellReady"

        static let defaultExternalURLOpener: ExternalURLOpener = { url in
            NSWorkspace.shared.open(url)
        }

        private let shellHost: ShellHost
        private let setLoadError: (ShellLoadError?) -> Void
        private let externalURLOpener: ExternalURLOpener
        let appSchemeHandler = AppSchemeHandler()

        init(
            shellHost: ShellHost,
            loadError: Binding<ShellLoadError?>,
            externalURLOpener: @escaping ExternalURLOpener = Coordinator.defaultExternalURLOpener
        ) {
            self.shellHost = shellHost
            setLoadError = { loadError.wrappedValue = $0 }
            self.externalURLOpener = externalURLOpener
        }

        // The webview only renders our own app shell. Any link that points outside our
        // origin is routed to the user's default browser. createWebViewWith handles
        // target=_blank and window.open; this policy hook is a safety net for clicks
        // that omit target=_blank (e.g. raw anchors inside rendered markdown).
        //
        // Only deliberate link clicks are handed off to the system browser. Form
        // submissions and back/forward navigations to external URLs are canceled
        // silently rather than launched — we don't want to lose POST bodies to a
        // GET in Safari, replay external history, or let programmatic window.open
        // calls launch the user's browser.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            let routing = WebShellLinkPolicy.route(
                forNavigationActionWith: navigationAction.request.url,
                navigationType: navigationAction.navigationType
            )
            if let url = routing.openExternally {
                externalURLOpener(url)
            }
            decisionHandler(routing.policy)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            let routing = WebShellLinkPolicy.route(
                forNavigationActionWith: navigationAction.request.url,
                navigationType: navigationAction.navigationType
            )
            if let url = routing.openExternally {
                externalURLOpener(url)
            }
            return nil
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            appSchemeHandler.clearImportHandoff()
            setLoadError(nil)
            // Every navigation (including the initial load) resets readiness.
            // Only the doc2mdShellReady message flips it back to ready, so
            // buffered external opens never flush against a stale web shell.
            shellHost.externalOpenRouter.markWebShellNotReady()
        }

        // Only the doc2mdShellReady message marks the router ready. didFinish
        // intentionally does not, because a finished navigation does not mean
        // the web app has registered its native event listeners yet.
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == Self.shellReadyMessageName else {
                return
            }

            shellHost.externalOpenRouter.markWebShellReady()
        }

        func webView(
            _ webView: WKWebView,
            runOpenPanelWith parameters: WKOpenPanelParameters,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping ([URL]?) -> Void
        ) {
            let panel = NSOpenPanel()
            panel.canChooseFiles = true
            panel.canChooseDirectories = false
            panel.allowsMultipleSelection = parameters.allowsMultipleSelection

            let response = panel.runModal()
            guard response == .OK else {
                completionHandler(nil)
                return
            }

            shellHost.shellBridge.rememberOpenPanelSelection(panel.urls)
            completionHandler(panel.urls)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            let alert = NSAlert()
            alert.messageText = message
            alert.alertStyle = .warning
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Cancel")
            let response = alert.runModal()
            completionHandler(response == .alertFirstButtonReturn)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            let alert = NSAlert()
            alert.messageText = message
            alert.alertStyle = .informational
            alert.addButton(withTitle: "OK")
            _ = alert.runModal()
            completionHandler()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            recordFailure(error, webView: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            recordFailure(error, webView: webView)
        }

        private func recordFailure(_ error: Error, webView: WKWebView) {
            let nsError = error as NSError
            guard nsError.domain != NSURLErrorDomain || nsError.code != NSURLErrorCancelled else {
                return
            }
            logger.error("load failed: \(error.localizedDescription, privacy: .public)")
            #if DEBUG
            let failingURL = nsError.userInfo[NSURLErrorFailingURLErrorKey] as? URL
            setLoadError(ShellLoadError(
                title: "Vite dev server is unavailable",
                url: failingURL?.absoluteString ?? webView.url?.absoluteString ?? "http://localhost:5173",
                message: error.localizedDescription,
                recovery: "Start the web app with npm run dev, then relaunch the Debug app."
            ))
            #endif
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            logger.notice("load succeeded: \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
        }
    }
}

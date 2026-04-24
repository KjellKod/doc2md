import OSLog
import SwiftUI
import WebKit

private let logger = Logger(subsystem: "com.kjellkod.doc2md", category: "webshell")

final class ShellHost: ObservableObject {
    let shellBridge = ShellBridge()
    let menuController = MenuController()

    func attach(webView: WKWebView) {
        shellBridge.webView = webView
        menuController.webView = webView
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
        Coordinator(loadError: $loadError)
    }

    func makeNSView(context: Context) -> WKWebView {
        let userContentController = WKUserContentController()
        shellHost.shellBridge.install(on: userContentController)

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.setURLSchemeHandler(context.coordinator.appSchemeHandler, forURLScheme: AppSchemeHandler.scheme)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
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

    final class Coordinator: NSObject, WKNavigationDelegate {
        private static let appReadyProbeIntervalSeconds: TimeInterval = 0.5
        private static let appReadyProbeMaxAttempts = 5
        private static let appReadyProbeTimeoutMs =
            Int(Double(appReadyProbeMaxAttempts - 1) * appReadyProbeIntervalSeconds * 1000)

        private let setLoadError: (ShellLoadError?) -> Void
        let appSchemeHandler = AppSchemeHandler()

        init(loadError: Binding<ShellLoadError?>) {
            setLoadError = { loadError.wrappedValue = $0 }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            setLoadError(nil)
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
            probeAppReady(in: webView, attempt: 1)
        }

        private func probeAppReady(in webView: WKWebView, attempt: Int) {
            webView.evaluateJavaScript("document.querySelector('[data-app-ready]') != null") { result, error in
                if let error {
                    guard attempt < Self.appReadyProbeMaxAttempts else {
                        logger.error(
                            "app ready: false: \(error.localizedDescription, privacy: .public) after \(Self.appReadyProbeTimeoutMs, privacy: .public) ms"
                        )
                        return
                    }

                    DispatchQueue.main.asyncAfter(deadline: .now() + Self.appReadyProbeIntervalSeconds) {
                        self.probeAppReady(in: webView, attempt: attempt + 1)
                    }
                    return
                }

                if let ready = result as? Bool, ready {
                    logger.notice("app ready: true")
                    return
                }

                guard attempt < Self.appReadyProbeMaxAttempts else {
                    logger.error("app ready: false: timeout after \(Self.appReadyProbeTimeoutMs, privacy: .public) ms")
                    return
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + Self.appReadyProbeIntervalSeconds) {
                    self.probeAppReady(in: webView, attempt: attempt + 1)
                }
            }
        }
    }
}

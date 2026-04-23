import AppKit
import WebKit

final class MenuController: NSObject {
    weak var webView: WKWebView?

    func newDocument() {
        dispatchNativeEvent("doc2md:native-new")
    }

    func openDocument() {
        dispatchNativeEvent("doc2md:native-open")
    }

    func saveDocument() {
        dispatchNativeEvent("doc2md:native-save")
    }

    func saveDocumentAs() {
        dispatchNativeEvent("doc2md:native-save-as")
    }

    func revealInFinder() {
        dispatchNativeEvent("doc2md:native-reveal-in-finder")
    }

    func closeWindow() {
        dispatchNativeEvent("doc2md:native-close-window") {
            NSApp.keyWindow?.performClose(nil)
        }
    }

    private func dispatchNativeEvent(_ eventName: String, completion: (() -> Void)? = nil) {
        let script = "window.dispatchEvent(new CustomEvent('\(eventName)'))"

        guard let webView else {
            completion?()
            return
        }

        webView.evaluateJavaScript(script) { _, error in
            #if DEBUG
            if let error {
                print("MenuController failed to dispatch \(eventName): \(error.localizedDescription)")
            }
            #endif

            completion?()
        }
    }
}

import AppKit
import SwiftUI
import WebKit

final class MenuController: NSObject {
    weak var webView: WKWebView?
    var licenseController: LicenseController?
    var updatePreferences: UpdateCheckPreferences?
    private var licenseWindowController: NSWindowController?
    private var aboutWindowController: AboutWindowController?
    private var thirdPartyLicensesWindowController: ThirdPartyLicensesWindowController?

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

    func showLicenseWindow() {
        guard let licenseController else {
            return
        }

        if let licenseWindowController {
            licenseWindowController.showWindow(nil)
            licenseWindowController.window?.makeKeyAndOrderFront(nil)
            return
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 360),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "License"
        window.center()
        window.contentView = NSHostingView(rootView: LicenseWindow(licenseController: licenseController))

        let controller = NSWindowController(window: window)
        licenseWindowController = controller
        controller.showWindow(nil)
        window.makeKeyAndOrderFront(nil)
    }

    func showAboutWindow() {
        if let aboutWindowController {
            aboutWindowController.show()
            return
        }

        let licenses = thirdPartyLicensesController()
        let controller = AboutWindowController(licensesController: licenses)
        aboutWindowController = controller
        controller.show()
    }

    func setLicensedMonthlyUpdateChecksEnabled(_ enabled: Bool) {
        updatePreferences?.licensedMonthlyChecksEnabled = enabled
    }

    private func thirdPartyLicensesController() -> ThirdPartyLicensesWindowController {
        if let thirdPartyLicensesWindowController {
            return thirdPartyLicensesWindowController
        }

        let controller = ThirdPartyLicensesWindowController()
        thirdPartyLicensesWindowController = controller
        return controller
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

// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
import AppKit
import SwiftUI

final class AboutWindowController: NSWindowController {
    private let licensesController: ThirdPartyLicensesWindowController

    init(licensesController: ThirdPartyLicensesWindowController) {
        self.licensesController = licensesController

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 360),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "About doc2md"
        window.center()
        window.isReleasedWhenClosed = false

        super.init(window: window)

        let view = AboutWindow(onShowLicenses: { [weak licensesController] in
            licensesController?.show()
        })
        window.contentView = NSHostingView(rootView: view)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    func show() {
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

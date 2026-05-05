// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
import AppKit
import OSLog
import SwiftUI

struct ThirdPartyLicensesWindow: View {
    private static let logger = Logger(
        subsystem: "com.kjellkod.doc2md",
        category: "ThirdPartyLicensesWindow"
    )

    let noticeText: String
    let onShowDesktopLicense: () -> Void

    init(onShowDesktopLicense: @escaping () -> Void) {
        noticeText = Self.loadNoticeText()
        self.onShowDesktopLicense = onShowDesktopLicense
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Third-Party Licenses")
                .font(.title)
                .fontWeight(.semibold)

            ScrollView {
                Text(noticeText)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minWidth: 640, minHeight: 420)

            HStack {
                Spacer()
                Button("doc2md Desktop License") {
                    onShowDesktopLicense()
                }
            }
        }
        .padding(20)
    }

    private static func loadNoticeText() -> String {
        guard let url = Bundle.main.url(forResource: "THIRD_PARTY_NOTICES", withExtension: "md") else {
            logger.error("missing bundled resource: THIRD_PARTY_NOTICES.md")
            return ""
        }

        do {
            let raw = try String(contentsOf: url, encoding: .utf8)
            return stripLeadingHeading(raw)
        } catch {
            logger.error(
                "failed to read THIRD_PARTY_NOTICES.md: \(error.localizedDescription, privacy: .public)"
            )
            return ""
        }
    }

    private static func stripLeadingHeading(_ text: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: "^#+\\s+.*\\n", options: []) else {
            return text
        }

        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return regex.stringByReplacingMatches(
            in: text,
            options: [.anchored],
            range: range,
            withTemplate: ""
        )
    }
}

final class ThirdPartyLicensesWindowController: NSWindowController {
    private lazy var desktopLicenseWindowController = DesktopLicenseWindowController()

    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Third-Party Licenses"
        window.center()
        window.isReleasedWhenClosed = false

        super.init(window: window)

        window.contentView = NSHostingView(
            rootView: ThirdPartyLicensesWindow(onShowDesktopLicense: { [weak self] in
                self?.desktopLicenseWindowController.show()
            })
        )
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

struct DesktopLicenseWindow: View {
    private static let logger = Logger(
        subsystem: "com.kjellkod.doc2md",
        category: "DesktopLicenseWindow"
    )

    let licenseText: String

    init() {
        licenseText = Self.loadLicenseText()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("doc2md Desktop License")
                .font(.title)
                .fontWeight(.semibold)

            ScrollView {
                Text(licenseText)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minWidth: 640, minHeight: 420)
        }
        .padding(20)
    }

    private static func loadLicenseText() -> String {
        guard let url = Bundle.main.url(
            forResource: "LicenseRef-doc2md-Desktop",
            withExtension: "txt"
        ) else {
            logger.error("missing bundled resource: LicenseRef-doc2md-Desktop.txt")
            return ""
        }

        do {
            return try String(contentsOf: url, encoding: .utf8)
        } catch {
            logger.error(
                "failed to read LicenseRef-doc2md-Desktop.txt: \(error.localizedDescription, privacy: .public)"
            )
            return ""
        }
    }
}

final class DesktopLicenseWindowController: NSWindowController {
    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "doc2md Desktop License"
        window.center()
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: DesktopLicenseWindow())

        super.init(window: window)
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

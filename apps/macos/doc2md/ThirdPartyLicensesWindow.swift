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

    init() {
        noticeText = Self.loadNoticeText()
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
        window.contentView = NSHostingView(rootView: ThirdPartyLicensesWindow())

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

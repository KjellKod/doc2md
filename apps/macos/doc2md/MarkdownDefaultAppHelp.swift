// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
import AppKit
import SwiftUI

// Thin UserDefaults wrapper for the one-time "make doc2md the default Markdown
// app" hint. Injectable defaults keep it testable. doc2md never changes the
// system default itself; this only tracks whether the user has dismissed the
// hint.
struct MarkdownDefaultAppHintPreferences {
    static let dismissedKey = "hasDismissedDefaultMarkdownAppHint"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasDismissedHint: Bool {
        get { defaults.bool(forKey: Self.dismissedKey) }
        nonmutating set { defaults.set(newValue, forKey: Self.dismissedKey) }
    }
}

// The instructions are identical whether shown as the first-run hint or via the
// always-available Help menu item. Only the first-run presentation offers the
// "Don't show again" control.
struct MarkdownDefaultAppHelpView: View {
    let showsDontShowAgain: Bool
    let onClose: () -> Void

    @State private var dontShowAgain = false
    private let onDontShowAgainChange: (Bool) -> Void

    init(
        showsDontShowAgain: Bool,
        onDontShowAgainChange: @escaping (Bool) -> Void = { _ in },
        onClose: @escaping () -> Void
    ) {
        self.showsDontShowAgain = showsDontShowAgain
        self.onDontShowAgainChange = onDontShowAgainChange
        self.onClose = onClose
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Make doc2md the Default Markdown App")
                .font(.title2)
                .fontWeight(.semibold)

            Text("macOS does not switch the default app for you. To open Markdown files in doc2md by double-clicking:")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                instruction(1, "Select a .md file in Finder.")
                instruction(2, "Choose File then Get Info, or press Command I.")
                instruction(3, "Under Open With, choose doc2md.")
                instruction(4, "Click Change All so every .md file opens in doc2md.")
                instruction(5, "Repeat for .markdown files if you use that extension.")
            }

            if showsDontShowAgain {
                Toggle("Don't show this again", isOn: $dontShowAgain)
                    .onChange(of: dontShowAgain) { newValue in
                        onDontShowAgainChange(newValue)
                    }
            }

            HStack {
                Spacer()
                Button("Got It") {
                    onClose()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(28)
        .frame(width: 460)
    }

    private func instruction(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(number).")
                .fontWeight(.semibold)
            Text(text)
        }
    }
}

// Owns the single help window. Reused for both the first-run hint and the Help
// menu item. Presenting via the menu never changes the dismissed preference.
final class MarkdownDefaultAppHelpController {
    private var preferences: MarkdownDefaultAppHintPreferences
    private var windowController: NSWindowController?
    private(set) var currentPresentationShowsDontShowAgain = false

    init(preferences: MarkdownDefaultAppHintPreferences = MarkdownDefaultAppHintPreferences()) {
        self.preferences = preferences
    }

    // First-run: only shown if the user has not dismissed the hint. Shows the
    // "Don't show again" control.
    func presentFirstRunHintIfNeeded() {
        guard !preferences.hasDismissedHint else {
            return
        }

        present(showsDontShowAgain: true)
    }

    // Help menu: always shown, no preference side effects.
    func presentHelp() {
        present(showsDontShowAgain: false)
    }

    private func present(showsDontShowAgain: Bool) {
        let controller: NSWindowController
        if let existingController = windowController {
            controller = existingController
        } else {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 460, height: 360),
                styleMask: [.titled, .closable],
                backing: .buffered,
                defer: false
            )
            window.title = "Default Markdown App"
            window.center()
            window.isReleasedWhenClosed = false
            controller = NSWindowController(window: window)
            windowController = controller
        }

        let view = MarkdownDefaultAppHelpView(
            showsDontShowAgain: showsDontShowAgain,
            onDontShowAgainChange: { [weak self] dismissed in
                if showsDontShowAgain {
                    self?.preferences.hasDismissedHint = dismissed
                }
            },
            onClose: { [weak controller] in
                controller?.close()
            }
        )
        currentPresentationShowsDontShowAgain = showsDontShowAgain
        controller.window?.contentView = NSHostingView(rootView: view)

        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

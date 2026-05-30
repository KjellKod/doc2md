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
// always-available Help menu item. An optional checkbox sits beneath them: the
// first-run hint uses it as "Don't show this again"; the Help menu uses it as
// "Show this reminder at startup" only when the hint was previously dismissed,
// giving users a way to turn the reminder back on. Nil means no checkbox (Help
// when the reminder is still enabled, which is purely informational).
struct MarkdownDefaultAppHelpView: View {
    struct CheckboxConfig {
        let title: String
        let initialOn: Bool
        let onChange: (Bool) -> Void
    }

    let checkbox: CheckboxConfig?
    let onClose: () -> Void

    @State private var isChecked: Bool

    init(checkbox: CheckboxConfig?, onClose: @escaping () -> Void) {
        self.checkbox = checkbox
        self.onClose = onClose
        _isChecked = State(initialValue: checkbox?.initialOn ?? false)
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

            if let checkbox {
                Toggle(checkbox.title, isOn: $isChecked)
                    .onChange(of: isChecked) { newValue in
                        checkbox.onChange(newValue)
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
    // True only for the Help presentation when the reminder was previously
    // dismissed, i.e. when the dialog offers the "Show this reminder at startup"
    // escape hatch back to the enabled state.
    private(set) var currentPresentationOffersReEnable = false
    // The first-run hint is evaluated at most once per launch. Opening another
    // file in an already-running app fires the main window's onAppear again;
    // that must not re-show a hint the user has already seen this session. The
    // persisted "Don't show again" flag handles suppression across launches.
    private var hasEvaluatedFirstRunHintThisLaunch = false
    private(set) var firstRunHintPresentationCount = 0

    init(preferences: MarkdownDefaultAppHintPreferences = MarkdownDefaultAppHintPreferences()) {
        self.preferences = preferences
    }

    // First-run: only shown if the user has not dismissed the hint. Shows the
    // "Don't show again" control.
    func presentFirstRunHintIfNeeded() {
        guard !hasEvaluatedFirstRunHintThisLaunch else {
            return
        }
        hasEvaluatedFirstRunHintThisLaunch = true

        guard !preferences.hasDismissedHint else {
            return
        }

        firstRunHintPresentationCount += 1
        currentPresentationShowsDontShowAgain = true
        currentPresentationOffersReEnable = false
        present(checkbox: .init(
            title: "Don't show this again",
            initialOn: false,
            onChange: { [weak self] dismissed in
                self?.preferences.hasDismissedHint = dismissed
            }
        ))
    }

    // Help menu: always available. If the reminder was previously dismissed it
    // offers a way to turn it back on (otherwise the first-run checkbox is a
    // one-way door); if still enabled it is purely informational.
    func presentHelp() {
        currentPresentationShowsDontShowAgain = false
        if preferences.hasDismissedHint {
            currentPresentationOffersReEnable = true
            present(checkbox: .init(
                title: "Show this reminder at startup",
                initialOn: !preferences.hasDismissedHint,
                onChange: { [weak self] showAtStartup in
                    self?.setStartupHintEnabled(showAtStartup)
                }
            ))
        } else {
            currentPresentationOffersReEnable = false
            present(checkbox: nil)
        }
    }

    // Called by the Help dialog's "Show this reminder at startup" toggle.
    func setStartupHintEnabled(_ enabled: Bool) {
        preferences.hasDismissedHint = !enabled
    }

    private func present(checkbox: MarkdownDefaultAppHelpView.CheckboxConfig?) {
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
            // The hint is shown from the main window's onAppear, but the
            // Finder-open flow brings the main window forward right after, which
            // would bury a normal-level hint behind it. A floating level cannot
            // be covered by the normal-level main window, so the hint stays
            // visible until the user dismisses it.
            window.level = .floating
            controller = NSWindowController(window: window)
            windowController = controller
        }

        let view = MarkdownDefaultAppHelpView(
            checkbox: checkbox,
            onClose: { [weak controller] in
                controller?.close()
            }
        )
        controller.window?.contentView = NSHostingView(rootView: view)

        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

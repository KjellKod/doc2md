import SwiftUI

@main
struct Doc2mdApp: App {
    @StateObject private var shellHost = ShellHost()
    private let sparkleController = SparkleController()

    // Multi-window is explicitly out of scope for the MVP (see
    // ideas/mac-desktop-app-roadmap.md). Using `Window` instead of `WindowGroup`
    // keeps a single shared `ShellHost` correct: `ShellBridge.webView` and
    // `MenuController.webView` can only ever point at one webview, so menu
    // events and bridge responses cannot be sent to the wrong window.
    var body: some Scene {
        Window("doc2md", id: "main") {
            WebShellView(shellHost: shellHost)
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New") {
                    shellHost.menuController.newDocument()
                }
                .keyboardShortcut("n", modifiers: [.command])

                Button("Open...") {
                    shellHost.menuController.openDocument()
                }
                .keyboardShortcut("o", modifiers: [.command])

                Divider()

                Button("Close Window") {
                    shellHost.menuController.closeWindow()
                }
                .keyboardShortcut("w", modifiers: [.command])
            }

            CommandGroup(replacing: .saveItem) {
                Button("Save") {
                    shellHost.menuController.saveDocument()
                }
                .keyboardShortcut("s", modifiers: [.command])

                Button("Save As...") {
                    shellHost.menuController.saveDocumentAs()
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])

                Divider()

                Button("Reveal in Finder") {
                    shellHost.menuController.revealInFinder()
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
            }

            CommandGroup(after: .appInfo) {
                Button("Check for Updates...") {
                    sparkleController.checkForUpdates()
                }
            }
        }
    }
}

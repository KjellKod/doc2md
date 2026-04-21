import SwiftUI

@main
struct Doc2mdApp: App {
    @StateObject private var shellHost = ShellHost()

    var body: some Scene {
        WindowGroup {
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
            }
        }
    }
}

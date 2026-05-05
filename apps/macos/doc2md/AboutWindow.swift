// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
import AppKit
import SwiftUI

struct AboutWindow: View {
    private static let docsURL = URL(string: "https://github.com/KjellKod/doc2md#readme")!
    private static let githubURL = URL(string: "https://github.com/KjellKod/doc2md")!

    let onShowLicenses: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            appIcon
                .frame(width: 96, height: 96)

            Text("doc2md")
                .font(.title)
                .fontWeight(.semibold)

            Text("Convert documents to Markdown with a fast, native macOS shell. Open, import, edit, and save without leaving your editor.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 4) {
                Text("Version \(Self.versionString)")
                    .font(.callout)
                Text("Build \(Self.buildString)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Text("Commit \(ReleaseCommit.value)")
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }

            HStack(spacing: 12) {
                Button("Docs") {
                    NSWorkspace.shared.open(Self.docsURL)
                }

                Button("GitHub") {
                    NSWorkspace.shared.open(Self.githubURL)
                }

                Button("Licenses") {
                    onShowLicenses()
                }
            }
        }
        .padding(28)
        .frame(width: 420)
    }

    @ViewBuilder
    private var appIcon: some View {
        if let icon = Self.appIconImage {
            Image(nsImage: icon)
                .resizable()
                .interpolation(.high)
        } else {
            Image(systemName: "doc.plaintext")
                .resizable()
                .foregroundStyle(.secondary)
        }
    }

    private static let appIconImage: NSImage? = {
        if let image = NSImage(named: NSImage.Name("AppIcon")) {
            return image
        }
        if let iconFile = Bundle.main.infoDictionary?["CFBundleIconFile"] as? String,
           let url = Bundle.main.url(forResource: iconFile, withExtension: nil) {
            return NSImage(contentsOf: url)
        }
        return NSApp?.applicationIconImage
    }()

    private static let versionString: String = {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }()

    private static let buildString: String = {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown"
    }()
}

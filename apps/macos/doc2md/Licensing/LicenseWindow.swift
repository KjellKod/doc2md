import SwiftUI

struct LicenseWindow: View {
    @ObservedObject var licenseController: LicenseController
    @State private var token = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)

            Text(stateDetails)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)

            TextEditor(text: $token)
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 120)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color(nsColor: .separatorColor), lineWidth: 1)
                )

            HStack {
                Button("Save License") {
                    _ = licenseController.enterLicense(token)
                    token = ""
                }
                .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Spacer()
            }
        }
        .padding(20)
        .frame(width: 520)
    }

    private var stateDetails: String {
        switch licenseController.state {
        case .licensed(let license):
            return "Licensed to \(licensedDisplayName(for: license)) for \(license.claims.tier)."
        case .unlicensed:
            return "Enter your license token below. The app remains usable without a license."
        case .invalid(let reason):
            return reason
        case .licenseCheckFailed(let reason):
            return "\(reason) The app remains usable."
        }
    }

    private func licensedDisplayName(for license: VerifiedLicense) -> String {
        let purchaser = license.claims.purchaser
        guard let displayName = purchaser.displayName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !displayName.isEmpty else {
            return purchaser.email
        }
        return "\(displayName) <\(purchaser.email)>"
    }

    private var title: String {
        switch licenseController.state {
        case .unlicensed:
            return "License"
        default:
            return licenseController.state.displayTitle
        }
    }
}

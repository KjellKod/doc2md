import SwiftUI

struct LicenseWindow: View {
    @ObservedObject var licenseController: LicenseController
    @State private var token = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(licenseController.state.displayTitle)
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
                Button("Enter License") {
                    _ = licenseController.enterLicense(token)
                    token = ""
                }
                .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Button("Buy License") {}
                    .disabled(true)
                    .help("Purchases are not live yet.")

                Text("Purchases are not live yet.")
                    .foregroundStyle(.secondary)

                Spacer()
            }
        }
        .padding(20)
        .frame(width: 520)
    }

    private var stateDetails: String {
        switch licenseController.state {
        case .licensed(let license):
            return "Licensed to \(license.claims.purchaser) for \(license.claims.tier)."
        case .unlicensed:
            return "The Mac app remains free to use. A paid license removes occasional reminders."
        case .invalid(let reason):
            return reason
        case .licenseCheckFailed(let reason):
            return "\(reason) The app remains usable."
        }
    }
}


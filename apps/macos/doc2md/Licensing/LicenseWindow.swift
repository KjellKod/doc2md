import SwiftUI

enum LicensePresentation {
    static func details(
        for state: LicenseState,
        dateFormatter: DateFormatter = defaultDateFormatter
    ) -> String {
        switch state {
        case .licensed(let entitlement):
            if let claims = entitlement.legacyClaims {
                return "Licensed to \(licensedDisplayName(for: claims)) for \(claims.tier)."
            }
            return "Your Polar license is active\(expiryPhrase(entitlement.expiresAt, formatter: dateFormatter))."
        case .grace(let entitlement):
            if let claims = entitlement.legacyClaims {
                return "Licensed to \(licensedDisplayName(for: claims)) for \(claims.tier). The app remains fully usable during the grace period."
            }
            return "Your Polar license expired\(expiryPhrase(entitlement.expiresAt, formatter: dateFormatter, prefix: " on")). doc2md remains fully usable during the grace period."
        case .expiredReminder:
            return "Licensed conveniences are paused. The app remains usable for opening, editing, converting, saving, and exporting documents."
        case .unlicensed:
            return "Enter your Polar license key. You can keep opening, editing, converting, saving, and exporting documents without one."
        case .invalid(let reason):
            return reason
        case .licenseCheckFailed(let reason):
            return "\(reason) The app remains usable."
        }
    }

    private static let defaultDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    private static func expiryPhrase(
        _ expiry: Date?,
        formatter: DateFormatter,
        prefix: String = " through"
    ) -> String {
        guard let expiry else {
            return ""
        }
        return "\(prefix) \(formatter.string(from: expiry))"
    }

    private static func licensedDisplayName(for claims: LicenseClaims) -> String {
        let purchaser = claims.purchaser
        guard let displayName = purchaser.displayName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !displayName.isEmpty
        else {
            return purchaser.email
        }
        return "\(displayName) <\(purchaser.email)>"
    }
}

struct LicenseWindow: View {
    @ObservedObject var licenseController: LicenseController
    @State private var key = ""
    @State private var confirmation: Confirmation?

    private enum Confirmation: String, Identifiable {
        case remove
        case replace

        var id: String { rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)

            Text(LicensePresentation.details(for: licenseController.state))
                .foregroundStyle(.secondary)
                .textSelection(.enabled)

            if licenseController.credentialsNeedReentry {
                Text("The cached license is available, but its Keychain credentials are missing. Re-enter the key to restore online validation.")
                    .foregroundStyle(.secondary)
            }

            SecureField("Polar license key", text: $key)
                .textFieldStyle(.roundedBorder)
                .disabled(licenseController.operation.disablesControls)

            if let progressText = licenseController.operation.progressText {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text(progressText)
                }
                .foregroundStyle(.secondary)
            }

            if let notice = licenseController.recoveryNotice {
                VStack(alignment: .leading, spacing: 8) {
                    Label(notice.message, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.secondary)
                    if notice.offersSlotRecovery {
                        HStack(spacing: 16) {
                            Link("Open Polar", destination: PolarLicenseConfiguration.recoveryURL)
                            Link("Email support", destination: PolarLicenseConfiguration.supportURL)
                        }
                    }
                }
            }

            HStack(spacing: 12) {
                Button(primaryButtonTitle) {
                    if licenseController.entryAction.requiresReplacementConfirmation {
                        confirmation = .replace
                    } else {
                        activate()
                    }
                }
                .disabled(trimmedKey.isEmpty || controlsDisabled)

                if licenseController.canRemovePolarLicense {
                    Button("Remove License", role: .destructive) {
                        confirmation = .remove
                    }
                    .disabled(controlsDisabled)
                }

                Spacer()
            }
        }
        .padding(20)
        .frame(width: 520)
        .confirmationDialog(
            confirmationTitle,
            isPresented: confirmationIsPresented,
            titleVisibility: .visible
        ) {
            switch confirmation {
            case .remove:
                Button("Remove License", role: .destructive) {
                    Task { await licenseController.removeLicense() }
                }
            case .replace:
                Button("Replace License", role: .destructive) {
                    replace()
                }
            case nil:
                EmptyView()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            switch confirmation {
            case .remove:
                Text("doc2md will deactivate this Mac in Polar before clearing its local license.")
            case .replace:
                Text("doc2md will deactivate the current license before activating the entered key.")
            case nil:
                EmptyView()
            }
        }
    }

    private var trimmedKey: String {
        key.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var controlsDisabled: Bool {
        licenseController.operation.disablesControls
    }

    private var primaryButtonTitle: String {
        licenseController.entryAction.title
    }

    private var confirmationTitle: String {
        switch confirmation {
        case .remove: return "Remove this license?"
        case .replace: return "Replace this license?"
        case nil: return "Confirm license change"
        }
    }

    private var confirmationIsPresented: Binding<Bool> {
        Binding(
            get: { confirmation != nil },
            set: { isPresented in
                if !isPresented {
                    confirmation = nil
                }
            }
        )
    }

    private var title: String {
        licenseController.state == .unlicensed ? "License" : licenseController.state.displayTitle
    }

    private func activate() {
        Task {
            if await licenseController.activate(key: key) {
                key = ""
            }
        }
    }

    private func replace() {
        Task {
            if await licenseController.replaceLicense(with: key) {
                key = ""
            }
        }
    }
}

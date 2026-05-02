import AppKit
import Foundation

final class LicenseReminderController {
    private let licenseController: LicenseController
    private let onEnterLicense: () -> Void
    private let showAlert: (NSAlert) -> NSApplication.ModalResponse
    private var successfulSaveCount = 0

    init(
        licenseController: LicenseController,
        onEnterLicense: @escaping () -> Void,
        showAlert: @escaping (NSAlert) -> NSApplication.ModalResponse = { $0.runModal() }
    ) {
        self.licenseController = licenseController
        self.onEnterLicense = onEnterLicense
        self.showAlert = showAlert
    }

    func recordSuccessfulSave() {
        successfulSaveCount += 1
        guard shouldShowReminder(afterSuccessfulSaveCount: successfulSaveCount) else {
            return
        }
        showReminder()
    }

    func shouldShowReminder(afterSuccessfulSaveCount count: Int) -> Bool {
        guard licenseController.state.allowsReminders else {
            return false
        }
        return count == 10 || (count > 10 && (count - 10) % 25 == 0)
    }

    private func showReminder() {
        let alert = NSAlert()
        alert.messageText = "doc2md is free to keep using."
        alert.informativeText = "A paid license removes these occasional save-count reminders. Purchases are not live yet."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Enter License...")
        alert.addButton(withTitle: "Not Now")

        if showAlert(alert) == .alertFirstButtonReturn {
            onEnterLicense()
        }
    }
}


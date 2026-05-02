import Foundation
import Sparkle

final class SparkleController: NSObject, SPUUpdaterDelegate {
    private static let feedURLEnvironmentKey = "DOC2MD_SPARKLE_FEED_URL"
    private let licenseController: LicenseController
    private let updatePreferences: UpdateCheckPreferences
    private let now: () -> Date
    private lazy var updaterController = SPUStandardUpdaterController(
        startingUpdater: false,
        updaterDelegate: self,
        userDriverDelegate: nil
    )

    init(
        licenseController: LicenseController = LicenseController(),
        updatePreferences: UpdateCheckPreferences = UpdateCheckPreferences(),
        now: @escaping () -> Date = Date.init,
        startAutomatically: Bool = true
    ) {
        self.licenseController = licenseController
        self.updatePreferences = updatePreferences
        self.now = now
        super.init()
        if startAutomatically {
            startUpdater()
        }
    }

    func checkForUpdates() {
        updaterController.checkForUpdates(nil)
    }

    func feedURLString(for updater: SPUUpdater) -> String? {
        guard let feedURL = ProcessInfo.processInfo.environment[Self.feedURLEnvironmentKey]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !feedURL.isEmpty
        else {
            return nil
        }

        return feedURL
    }

    var licensedMonthlyChecksEnabled: Bool {
        get {
            updatePreferences.licensedMonthlyChecksEnabled
        }
        set {
            updatePreferences.licensedMonthlyChecksEnabled = newValue
        }
    }

    func shouldRunAutomaticCheck() -> Bool {
        updatePolicy.shouldRunAutomaticCheck(for: licenseController.state)
    }

    func recordAutomaticCheck() {
        updatePolicy.recordAutomaticCheck(for: licenseController.state)
    }

    private var updatePolicy: UpdateCheckPolicy {
        UpdateCheckPolicy(preferences: updatePreferences, now: now)
    }

    private func startUpdater() {
        do {
            try updaterController.startUpdater()
            if shouldRunAutomaticCheck() {
                updaterController.updater.checkForUpdatesInBackground()
                recordAutomaticCheck()
            }
        } catch {
            #if DEBUG
            print("Sparkle updater failed to start: \(error.localizedDescription)")
            #endif
        }
    }
}

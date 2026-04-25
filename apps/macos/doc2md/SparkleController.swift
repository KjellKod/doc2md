import Foundation
import Sparkle

final class SparkleController: NSObject, SPUUpdaterDelegate {
    private static let feedURLEnvironmentKey = "DOC2MD_SPARKLE_FEED_URL"

    private lazy var updaterController = SPUStandardUpdaterController(
        startingUpdater: false,
        updaterDelegate: self,
        userDriverDelegate: nil
    )

    override init() {
        super.init()
        startUpdater()
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

    private func startUpdater() {
        do {
            try updaterController.startUpdater()
        } catch {
            #if DEBUG
            print("Sparkle updater failed to start: \(error.localizedDescription)")
            #endif
        }
    }
}
